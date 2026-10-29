package com.eventchat.modules.decision.service.impl;

import com.eventchat.common.util.TokenUtil;
import com.eventchat.common.exception.GlobalExceptionHandler;
import com.eventchat.modules.decision.controller.DecisionController;
import com.eventchat.modules.decision.dto.request.ConfirmDecisionRequest;
import com.eventchat.modules.decision.dto.request.CreateDecisionRequest;
import com.eventchat.modules.decision.dto.request.UpdateDecisionStatusRequest;
import com.eventchat.modules.decision.dto.response.DecisionResponse;
import com.eventchat.modules.decision.entity.Decision;
import com.eventchat.modules.decision.enums.ConfirmationChoice;
import com.eventchat.modules.decision.enums.DecisionStatus;
import com.eventchat.modules.decision.repository.DecisionConfirmationRepository;
import com.eventchat.modules.decision.repository.DecisionRepository;
import com.eventchat.modules.decision.service.DecisionService;
import com.eventchat.modules.room.entity.Room;
import com.eventchat.modules.room.entity.RoomSession;
import com.eventchat.modules.room.enums.RoomStatus;
import com.eventchat.modules.room.repository.RoomRepository;
import com.eventchat.modules.room.repository.RoomSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

class DecisionServiceImplTest {
    private static final String SLUG = "room-a";
    private static final String SESSION_TOKEN = "session-token";
    private static final String HOST_TOKEN = "host-token";
    private final RoomRepository rooms = mock(RoomRepository.class);
    private final RoomSessionRepository sessions = mock(RoomSessionRepository.class);
    private final DecisionRepository decisions = mock(DecisionRepository.class);
    private final DecisionConfirmationRepository confirmations = mock(DecisionConfirmationRepository.class);
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);
    private final DecisionServiceImpl service = new DecisionServiceImpl(
            rooms, sessions, decisions, confirmations, broker, new ObjectMapper(),
            mock(com.eventchat.modules.interaction.wheel.repository.WheelSpinRepository.class));

    enum Command { CREATE, VOTE, UPDATE }

    static Stream<Arguments> unwritableRooms() {
        return Stream.of(Command.values()).flatMap(command -> Stream.of(
                Arguments.of(command, RoomStatus.CREATED, false),
                Arguments.of(command, RoomStatus.CLOSED, false),
                Arguments.of(command, RoomStatus.EXPIRED, false),
                Arguments.of(command, RoomStatus.ACTIVE, true)));
    }

    @ParameterizedTest
    @MethodSource("unwritableRooms")
    void unwritableRoomRejectsEveryWriteBeforeReadingOrChangingDecisions(
            Command command, RoomStatus status, boolean expired) {
        setupRoom(status, expired);
        assertThrows(IllegalArgumentException.class, () -> invoke(service, command));
        verifyNoInteractions(decisions, confirmations, broker);
    }

    @ParameterizedTest
    @ValueSource(strings = {"session-token", "other-room-host-token"})
    void participantOrOtherRoomsHostCannotFinalizeDecision(String token) {
        setupRoom(RoomStatus.ACTIVE, false);
        var request = UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build();
        assertThrows(SecurityException.class,
                () -> service.updateDecisionStatus(SLUG, 10L, token, request));
        verifyNoInteractions(decisions, confirmations, broker);
    }

    @ParameterizedTest
    @EnumSource(Command.class)
    void activeRoomAcceptsWritesAndBroadcastsOnlyAfterTheTransactionCommits(Command command) {
        setupWritableDecision();
        var transactions = new TestTransactionManager();
        DecisionService transactionalService = transactionalProxy(transactions);
        doAnswer(call -> {
            assertTrue(transactions.committed, "Broadcast must happen after commit");
            return null;
        }).when(broker).convertAndSend(anyString(), any(Object.class));

        DecisionResponse response = invoke(transactionalService, command);

        assertTrue(transactions.committed);
        assertFalse(transactions.rolledBack);
        assertEquals(10L, response.getId());
        assertEquals("Choose A", response.getText());
        assertEquals(command == Command.UPDATE ? DecisionStatus.CONFIRMED : DecisionStatus.PROPOSED,
                response.getStatus());
        if (command == Command.UPDATE) assertNotNull(response.getConfirmedAt());
        if (command == Command.VOTE) verify(confirmations).save(any());
        else verify(decisions).save(any());
        verify(broker).convertAndSend(eq("/topic/room." + SLUG + ".decisions"), same(response));
        verifyNoMoreInteractions(broker);
        assertFalse(TransactionSynchronizationManager.isSynchronizationActive());
    }

    @ParameterizedTest
    @EnumSource(Command.class)
    void rollbackDoesNotBroadcastEvenAfterTheWriteMethodReturned(Command command) {
        setupWritableDecision();
        var transactions = new TestTransactionManager();
        var template = new TransactionTemplate(transactions);

        assertThrows(IllegalStateException.class, () -> template.execute(status -> {
            invoke(service, command);
            verifyNoInteractions(broker);
            throw new IllegalStateException("Failure before transaction commit");
        }));

        assertTrue(transactions.rolledBack);
        assertFalse(transactions.committed);
        verifyNoInteractions(broker);
        assertFalse(TransactionSynchronizationManager.isSynchronizationActive());
    }

    @Test
    void closedRoomDecisionsRemainReadable() {
        setupRoom(RoomStatus.CLOSED, false);
        when(decisions.findAllByRoomIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());
        assertTrue(service.getDecisionsByRoom(SLUG).isEmpty());
        verifyNoInteractions(broker);
    }

    @ParameterizedTest
    @CsvSource({
            "DRAFT, DRAFT, false", "DRAFT, PROPOSED, true",
            "DRAFT, CONFIRMED, false", "DRAFT, REJECTED, false",
            "PROPOSED, DRAFT, false", "PROPOSED, PROPOSED, false",
            "PROPOSED, CONFIRMED, true", "PROPOSED, REJECTED, true",
            "CONFIRMED, DRAFT, false", "CONFIRMED, PROPOSED, false",
            "CONFIRMED, CONFIRMED, false", "CONFIRMED, REJECTED, false",
            "REJECTED, DRAFT, false", "REJECTED, PROPOSED, false",
            "REJECTED, CONFIRMED, false", "REJECTED, REJECTED, false"
    })
    void enforcesEveryStateTransitionAndSetsConfirmedAtOnlyWhenFinalizing(
            DecisionStatus current, DecisionStatus next, boolean allowed) {
        Decision decision = setupWritableDecision();
        decision.setStatus(current);
        Instant originalConfirmedAt = current == DecisionStatus.CONFIRMED
                ? Instant.parse("2026-10-20T00:00:00Z") : null;
        decision.setConfirmedAt(originalConfirmedAt);
        var request = UpdateDecisionStatusRequest.builder().status(next).build();

        if (!allowed) {
            assertThrows(IllegalArgumentException.class,
                    () -> service.updateDecisionStatus(SLUG, 10L, HOST_TOKEN, request));
            assertEquals(current, decision.getStatus(), "Rejected request must not mutate the entity");
            assertEquals(originalConfirmedAt, decision.getConfirmedAt());
            verify(decisions, never()).save(any());
            verifyNoInteractions(confirmations, broker);
            return;
        }

        Instant before = Instant.now();
        var response = service.updateDecisionStatus(SLUG, 10L, HOST_TOKEN, request);
        Instant after = Instant.now();
        assertEquals(next, decision.getStatus());
        assertEquals(next, response.getStatus());
        if (next == DecisionStatus.CONFIRMED) {
            assertNotNull(response.getConfirmedAt());
            assertEquals(decision.getConfirmedAt(), response.getConfirmedAt());
            assertFalse(response.getConfirmedAt().isBefore(before));
            assertFalse(response.getConfirmedAt().isAfter(after));
        } else {
            assertNull(decision.getConfirmedAt());
            assertNull(response.getConfirmedAt());
        }
        verify(decisions).save(same(decision));
        verify(broker).convertAndSend(eq("/topic/room." + SLUG + ".decisions"), same(response));
    }

    @ParameterizedTest
    @EnumSource(DecisionStatus.class)
    void nullTargetIsRejectedWithoutChangingAnyCurrentState(DecisionStatus current) {
        Decision decision = setupWritableDecision();
        decision.setStatus(current);
        var request = UpdateDecisionStatusRequest.builder().status(null).build();
        assertThrows(IllegalArgumentException.class,
                () -> service.updateDecisionStatus(SLUG, 10L, HOST_TOKEN, request));
        assertEquals(current, decision.getStatus());
        verify(decisions, never()).save(any());
        verifyNoInteractions(confirmations, broker);
    }

    @ParameterizedTest
    @EnumSource(value = DecisionStatus.class, names = {"DRAFT", "CONFIRMED", "REJECTED"})
    void votingOutsideProposedReturns400AndDoesNotSaveOrBroadcast(DecisionStatus current) throws Exception {
        Decision decision = setupWritableDecision();
        decision.setStatus(current);
        mvc().perform(post("/api/v1/rooms/{slug}/decisions/{id}/confirm", SLUG, 10L)
                        .header("X-Session-Token", SESSION_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"choice\":\"APPROVE\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(current, decision.getStatus());
        verify(decisions, never()).save(any());
        verifyNoInteractions(confirmations, broker);
    }

    @ParameterizedTest
    @CsvSource({"DRAFT, CONFIRMED", "PROPOSED, DRAFT", "PROPOSED, PROPOSED",
            "CONFIRMED, REJECTED", "REJECTED, CONFIRMED", "REJECTED, REJECTED"})
    void invalidTransitionReturns400ThroughTheRealControllerAndService(
            DecisionStatus current, DecisionStatus next) throws Exception {
        Decision decision = setupWritableDecision();
        decision.setStatus(current);
        mvc().perform(patch("/api/v1/rooms/{slug}/decisions/{id}/status", SLUG, 10L)
                        .header("X-Host-Token", HOST_TOKEN).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"" + next + "\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(current, decision.getStatus());
        verify(decisions, never()).save(any());
        verifyNoInteractions(confirmations, broker);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"status\":null}"})
    void missingTargetIsRejectedByHttpValidationBeforeCallingTheService(String body) throws Exception {
        mvc().perform(patch("/api/v1/rooms/{slug}/decisions/{id}/status", SLUG, 10L)
                        .header("X-Host-Token", HOST_TOKEN)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(rooms, sessions, decisions, confirmations, broker);
    }

    @ParameterizedTest
    @EnumSource(value = Command.class, names = {"VOTE", "UPDATE"})
    void roomExpiringWhileWaitingForTheDecisionLockRejectsTheWrite(Command command) {
        Decision decision = setupWritableDecision();
        when(decisions.findByIdAndRoomIdForUpdate(10L, 1L)).thenAnswer(call -> {
            decision.getRoom().setExpiresAt(Instant.now().minusSeconds(1));
            return Optional.of(decision);
        });
        assertThrows(IllegalArgumentException.class, () -> invoke(service, command));
        assertEquals(DecisionStatus.PROPOSED, decision.getStatus());
        verify(decisions, never()).save(any());
        verifyNoInteractions(confirmations, broker);
    }

    private MockMvc mvc() {
        return MockMvcBuilders.standaloneSetup(new DecisionController(service, org.mockito.Mockito.mock(com.eventchat.modules.room.service.RoomAccessService.class)))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(
                        new ObjectMapper().findAndRegisterModules()))
                .build();
    }

    @Test
    void recordsTheAuthenticatedConfirmerSeparatelyFromTheProposalCreator() throws Exception {
        Decision decision = setupWritableDecision();
        RoomSession author = RoomSession.builder().nickname("Người đề xuất").guestId("author").build();
        decision.setCreatedBy(author);
        RoomSession host = RoomSession.builder().room(decision.getRoom()).nickname("Lan")
                .guestId("host-guest").role(com.eventchat.modules.room.enums.SessionRole.HOST).build();
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256("host-session")))
                .thenReturn(Optional.of(host));
        when(confirmations.countByDecisionIdAndChoice(10L, ConfirmationChoice.APPROVE)).thenReturn(3L);
        mvc().perform(patch("/api/v1/rooms/{slug}/decisions/{id}/status", SLUG, 10L)
                        .header("X-Host-Token", HOST_TOKEN).header("X-Session-Token", "host-session")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"CONFIRMED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.creatorNickname").value("Người đề xuất"))
                .andExpect(jsonPath("$.data.confirmedByNickname").value("Lan"))
                .andExpect(jsonPath("$.data.confirmedByGuestId").value("host-guest"))
                .andExpect(jsonPath("$.data.approveCount").value(3))
                .andExpect(jsonPath("$.data.confirmedAt").isNotEmpty());
        assertEquals("Lan", decision.getConfirmedByNickname());
        host.setNickname("New nickname");
        assertEquals("Lan", decision.getConfirmedByNickname());
    }

    @ParameterizedTest
    @ValueSource(strings = {"revoked-session", SESSION_TOKEN})
    void invalidOrParticipantSessionCannotBeRecordedAsTheConfirmer(String sessionToken) {
        Decision decision = setupWritableDecision();
        assertThrows(SecurityException.class, () -> service.updateDecisionStatus(SLUG, 10L, HOST_TOKEN, sessionToken,
                UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build()));
        assertEquals(DecisionStatus.PROPOSED, decision.getStatus());
        assertNull(decision.getConfirmedByNickname());
        assertNull(decision.getConfirmedAt());
        verify(decisions, never()).save(any());
    }

    @Test
    void hostTokenOnlyClientsDoNotMisattributeTheProposalCreatorAsConfirmer() {
        Decision decision = setupWritableDecision();
        decision.setCreatedBy(RoomSession.builder().nickname("Author").build());
        var response = service.updateDecisionStatus(SLUG, 10L, HOST_TOKEN,
                UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build());
        assertEquals("Author", response.getCreatorNickname());
        assertNull(response.getConfirmedByNickname());
        assertNull(response.getConfirmedByGuestId());
    }

    private DecisionResponse invoke(DecisionService target, Command command) {
        return switch (command) {
            case CREATE -> target.createDecision(SLUG, SESSION_TOKEN, CreateDecisionRequest.builder()
                    .text("Choose A").proposeImmediately(true).evidenceRefs(List.of()).build());
            case VOTE -> target.confirmDecision(SLUG, 10L, SESSION_TOKEN,
                    ConfirmDecisionRequest.builder().choice(ConfirmationChoice.APPROVE).build());
            case UPDATE -> target.updateDecisionStatus(SLUG, 10L, HOST_TOKEN,
                    UpdateDecisionStatusRequest.builder().status(DecisionStatus.CONFIRMED).build());
        };
    }

    private Room setupRoom(RoomStatus status, boolean expired) {
        Room room = Room.builder().slug(SLUG).roomStatus(status)
                .hostTokenHash(TokenUtil.sha256(HOST_TOKEN))
                .expiresAt(Instant.now().plusSeconds(expired ? -60 : 3600)).build();
        room.setId(1L);
        when(rooms.findBySlug(SLUG)).thenReturn(Optional.of(room));
        when(rooms.findBySlugForUpdate(SLUG)).thenReturn(Optional.of(room));
        RoomSession session = RoomSession.builder().room(room).nickname("Guest").build();
        session.setId(2L);
        when(sessions.findByRoomIdAndSessionTokenHashAndRevokedAtIsNull(1L, TokenUtil.sha256(SESSION_TOKEN)))
                .thenReturn(Optional.of(session));
        return room;
    }

    private Decision setupWritableDecision() {
        Room room = setupRoom(RoomStatus.ACTIVE, false);
        Decision decision = Decision.builder().room(room).text("Choose A")
                .status(DecisionStatus.PROPOSED).evidenceRefs("[]").build();
        decision.setId(10L);
        when(decisions.findByIdAndRoomIdForUpdate(10L, 1L)).thenReturn(Optional.of(decision));
        when(decisions.save(any(Decision.class))).thenAnswer(call -> {
            Decision saved = call.getArgument(0);
            saved.setId(10L);
            return saved;
        });
        return decision;
    }

    private DecisionService transactionalProxy(TestTransactionManager transactions) {
        var advice = new TransactionInterceptor();
        advice.setTransactionManager(transactions);
        advice.setTransactionAttributeSource(new AnnotationTransactionAttributeSource());
        var proxy = new ProxyFactory(service);
        proxy.addAdvice(advice);
        return (DecisionService) proxy.getProxy();
    }

    private final class TestTransactionManager extends AbstractPlatformTransactionManager {
        private boolean committed;
        private boolean rolledBack;

        @Override
        protected Object doGetTransaction() { return new Object(); }

        @Override
        protected void doBegin(Object transaction, TransactionDefinition definition) {}

        @Override
        protected void doCommit(DefaultTransactionStatus status) {
            verifyNoInteractions(broker);
            committed = true;
        }

        @Override
        protected void doRollback(DefaultTransactionStatus status) { rolledBack = true; }
    }
}
