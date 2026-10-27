package com.eventchat.modules.room.service;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;


public final class RoomCacheInvalidation {
    private RoomCacheInvalidation() {}

    public static void afterCommit(RoomCacheService cache, List<String> slugs) {
        List<String> snapshot = List.copyOf(slugs);
        Runnable evict = () -> snapshot.forEach(cache::evict);
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            evict.run();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() { evict.run(); }
        });
    }
}
