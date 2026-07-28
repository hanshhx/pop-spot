package com.example.popspotbackend.service;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class AccountDeletionServiceTest {

    @AfterEach
    void clearTransactionState() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        TransactionSynchronizationManager.setActualTransactionActive(false);
    }

    @Test
    void 업로드_파일은_DB_커밋_전에는_삭제하지_않는다() {
        UploadedFileCleaner cleaner = mock(UploadedFileCleaner.class);
        AccountDeletionService service = serviceWith(cleaner);
        List<String> files = List.of("/uploads/profile.webp", "/uploads/chat.webp");

        TransactionSynchronizationManager.setActualTransactionActive(true);
        TransactionSynchronizationManager.initSynchronization();

        service.scheduleFileCleanupAfterCommit(files);

        verifyNoInteractions(cleaner);
        for (TransactionSynchronization synchronization :
                TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        verify(cleaner).deleteAll(files);
    }

    @Test
    void 트랜잭션이_없으면_파일을_즉시_정리한다() {
        UploadedFileCleaner cleaner = mock(UploadedFileCleaner.class);
        AccountDeletionService service = serviceWith(cleaner);
        List<String> files = List.of("/uploads/profile.webp");

        service.scheduleFileCleanupAfterCommit(files);

        verify(cleaner).deleteAll(files);
    }

    private AccountDeletionService serviceWith(UploadedFileCleaner cleaner) {
        return new AccountDeletionService(
                null, null, null, null, null, null, null, null, null, null, null, null, cleaner);
    }
}
