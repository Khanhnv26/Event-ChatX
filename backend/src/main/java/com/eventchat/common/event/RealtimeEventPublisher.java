package com.eventchat.common.event;

import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Slf4j
public final class RealtimeEventPublisher {
    private RealtimeEventPublisher() {}

    public static void afterCommit(SimpMessagingTemplate broker, String destination, Object payload) {
        Runnable send = () -> {
            try {
                broker.convertAndSend(destination, payload);
            } catch (RuntimeException error) {
                log.warn("Realtime delivery failed for {}", destination, error);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { send.run(); }
            });
        } else {
            send.run();
        }
    }
}
