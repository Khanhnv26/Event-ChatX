package com.eventchat.modules.room.service.impl;

import com.eventchat.modules.room.service.RoomCacheInvalidation;
import com.eventchat.modules.room.service.RoomCacheService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;

import static org.mockito.Mockito.*;

class RoomCacheInvalidationTest {
    private final RoomCacheService cache = mock(RoomCacheService.class);

    @AfterEach
    void cleanup() {
        if (TransactionSynchronizationManager.isSynchronizationActive())
            TransactionSynchronizationManager.clearSynchronization();
    }

    @Test
    void cacheIsEvictedOnlyAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();
        RoomCacheInvalidation.afterCommit(cache, List.of("room"));
        verifyNoInteractions(cache);
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(cache).evict("room");
    }

    @Test
    void rollbackLeavesCacheIntact() {
        TransactionSynchronizationManager.initSynchronization();
        RoomCacheInvalidation.afterCommit(cache, List.of("room"));
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        verifyNoInteractions(cache);
    }
}
