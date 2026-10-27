# Graph Report - event_chat  (2026-10-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 901 nodes · 2018 edges · 59 communities (29 shown, 30 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 77 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8c7608ab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 58

## God Nodes (most connected - your core abstractions)
1. `ApiResponse` - 39 edges
2. `RoomSession` - 30 edges
3. `Room` - 29 edges
4. `PollResponse` - 28 edges
5. `DecisionResponse` - 27 edges
6. `BaseEntity` - 24 edges
7. `RoomRepository` - 22 edges
8. `WheelResponse` - 21 edges
9. `react` - 21 edges
10. `RoomAuthResponse` - 20 edges

## Surprising Connections (you probably didn't know these)
- `DecisionResponse` --references--> `DecisionStatus`  [EXTRACTED]
  backend/src/main/java/com/eventchat/modules/decision/dto/response/DecisionResponse.java → backend/src/main/java/com/eventchat/modules/decision/enums/DecisionStatus.java
- `RoomExportResponse` --references--> `DecisionResponse`  [EXTRACTED]
  backend/src/main/java/com/eventchat/modules/export/dto/response/RoomExportResponse.java → backend/src/main/java/com/eventchat/modules/decision/dto/response/DecisionResponse.java
- `DecisionController` --references--> `DecisionService`  [EXTRACTED]
  backend/src/main/java/com/eventchat/modules/decision/controller/DecisionController.java → backend/src/main/java/com/eventchat/modules/decision/service/DecisionService.java
- `DecisionServiceImpl` --references--> `DecisionConfirmationRepository`  [EXTRACTED]
  backend/src/main/java/com/eventchat/modules/decision/service/impl/DecisionServiceImpl.java → backend/src/main/java/com/eventchat/modules/decision/repository/DecisionConfirmationRepository.java
- `DecisionServiceImpl` --references--> `DecisionRepository`  [EXTRACTED]
  backend/src/main/java/com/eventchat/modules/decision/service/impl/DecisionServiceImpl.java → backend/src/main/java/com/eventchat/modules/decision/repository/DecisionRepository.java

## Import Cycles
- None detected.

## Communities (59 total, 30 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (13): TokenUtil, DecisionResponse, DecisionService, DecisionServiceImpl, TypeReference<List<String>>, ExportService, ExportServiceImpl, PollServiceImpl (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (6): PollController, CastVoteRequest, CreatePollRequest, PollOptionResponse, PollResponse, PollService

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (6): WheelController, CreateWheelRequest, SpinWheelRequest, WheelResponse, WheelSpinResponse, WheelService

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (3): BaseEntity, Room, RoomSession

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (7): ExportController, RoomExportResponse, RoomStatus, ACTIVE, CLOSED, CREATED, EXPIRED

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (20): App(), AppContent(), LandingPage, RoomPage, Preloader(), PreloaderProps, PreloaderContext, PreloaderContextType (+12 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (28): RABBITMQ_DEFAULT_PASS, RABBITMQ_DEFAULT_USER, interval, retries, test, timeout, container_name, entrypoint (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.16
Nodes (22): ChatInputBar, ChatInputBarProps, ExportSummaryModalProps, RoomQrModal(), RoomQrModalProps, RoomWorkspaceViewProps, WheelSpinModalProps, INITIAL_DECISIONS (+14 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (23): AVATAR_COLORS, formatTime(), pickAvatarColor(), useEventChat(), UserSession, eventChatApi, RoomSubscriptions, stompClient (+15 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (3): RedisKeys, RoomCacheServiceImpl, SessionCacheServiceImpl

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (6): SenderInfo, ParticipantResponse, SessionRole, HOST, MODERATOR, PARTICIPANT

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (5): DecisionConfirmation, ConfirmationChoice, APPROVE, REJECT, DecisionConfirmationRepository

### Community 12 - "Community 12"
Cohesion: 0.11
Nodes (3): Wheel, WheelSpin, WheelSpinRepository

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (3): RoomController, RoomAuthResponse, RoomService

### Community 14 - "Community 14"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (7): Decision, DecisionStatus, CONFIRMED, DRAFT, PROPOSED, REJECTED, DecisionRepository

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (18): dependencies, canvas-confetti@^1.9.4, clsx@^2.1.1, lucide-react@^1.61.0, qrcode.react@^4.2.0, react@^19.3.1, react-router-dom@^7.18.4, sockjs-client@^1.6.1 (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 20 - "Community 20"
Cohesion: 0.21
Nodes (4): ChatController, SystemMessageListener, ChatService, RoomExpireJob

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (5): Poll, PollStatus, CLOSED, OPEN, PollRepository

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer@^10.6.1, oxlint@^1.88.0, postcss@^8.5.31, @types/canvas-confetti@^1.9.0, @types/react-dom@^19.3.0, @types/sockjs-client@^1.5.4, typescript@~6.0.3 (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (12): useRoomSession(), CreatePollModal(), CreatePollModalProps, ExportSummaryModal(), MessengerIcon(), TelegramIcon(), ZaloIcon(), JoinRoomModal() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (7): MessageResponse, MessageType, DECISION_EVENT, POLL_EVENT, SYSTEM, TEXT, WHEEL_EVENT

### Community 34 - "Community 34"
Cohesion: 0.49
Nodes (10): decision_confirmations, decisions, messages, poll_options, poll_votes, polls, room_sessions, rooms (+2 more)

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): react-dom@^19.3.1, tailwindcss@^4.3.3, name, private, type, version, react-dom, tailwindcss

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (6): @tailwindcss/vite@^4.3.3, vite@^8.3.4, @vitejs/plugin-react@^6.1.2, @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 51 - "Community 51"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 52 - "Community 52"
Cohesion: 0.50
Nodes (3): axios@^1.20.0, apiClient, axios

## Knowledge Gaps
- **21 isolated node(s):** `HOST`, `MODERATOR`, `PARTICIPANT`, `APPROVE`, `REJECT` (+16 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 370 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RoomSession` connect `Community 3` to `Community 0`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 16`, `Community 21`, `Community 27`, `Community 30`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `HOST`, `MODERATOR`, `PARTICIPANT` to the rest of the system?**
  _21 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07074504442925496 - nodes in this community are weakly interconnected._
- **Why does `ApiResponse` connect `Community 28` to `Community 0`, `Community 1`, `Community 2`, `Community 35`, `Community 36`, `Community 4`, `Community 38`, `Community 39`, `Community 43`, `Community 44`, `Community 13`, `Community 26`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07087486157253599 - nodes in this community are weakly interconnected._
- **Why does `Room` connect `Community 3` to `Community 0`, `Community 4`, `Community 9`, `Community 11`, `Community 12`, `Community 16`, `Community 21`, `Community 27`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07308970099667775 - nodes in this community are weakly interconnected._