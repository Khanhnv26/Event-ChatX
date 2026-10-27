package com.eventchat.common.event;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RealtimeEventPublisherTest {
    private final SimpMessagingTemplate broker = mock(SimpMessagingTemplate.class);

    @AfterEach
    void cleanup() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void publishesOnlyAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();
        RealtimeEventPublisher.afterCommit(broker, "/topic/test", "payload");
        verifyNoInteractions(broker);
        TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
        verify(broker).convertAndSend("/topic/test", "payload");
    }

    @Test
    void brokerFailureDoesNotTurnAnAlreadyCommittedActionIntoAnError() {
        doThrow(new IllegalStateException("offline")).when(broker).convertAndSend("/topic/test", "payload");
        assertDoesNotThrow(() -> RealtimeEventPublisher.afterCommit(broker, "/topic/test", "payload"));
    }
}
