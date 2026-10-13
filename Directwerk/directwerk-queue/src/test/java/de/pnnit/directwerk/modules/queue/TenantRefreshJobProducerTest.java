package de.pnnit.directwerk.modules.queue;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

class TenantRefreshJobProducerTest {

    private final QueueService queueService = mock(QueueService.class);
    private final DirectwerkConfig config = mock(DirectwerkConfig.class);
    private final ObjectProvider<QueueService> provider = providerOf(queueService);

    @AfterEach
    void clearSynchronization() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void enqueuesInNewTransactionWhenNoTransactionIsActive() {
        when(config.isQueueEnabled()).thenReturn(true);

        producer().requestRefreshAfterCommit(7L);

        verify(queueService).enqueueInNewTransaction(
                eq("rss-refresh"), any(), eq(0), isNull(), isNull(), any(JobEnqueueMetadata.class));
    }

    @Test
    void enqueueRunsOnlyAfterCommitAndInAFreshTransaction() {
        when(config.isQueueEnabled()).thenReturn(true);
        TenantRefreshJobProducer producer = producer();
        TransactionSynchronizationManager.initSynchronization();

        producer.requestRefreshAfterCommit(7L);

        // Nothing is enqueued while the caller's transaction is still open.
        verify(queueService, never()).enqueueInNewTransaction(
                any(), any(), any(Integer.class), any(), any(), any());

        List<TransactionSynchronization> synchronizations =
                TransactionSynchronizationManager.getSynchronizations();
        synchronizations.forEach(TransactionSynchronization::afterCommit);

        // Issue #300: the after-commit hook must use the fresh-transaction variant, otherwise the
        // INSERT joins the already-committed transaction and the job is silently lost.
        verify(queueService).enqueueInNewTransaction(
                eq("rss-refresh"), any(), eq(0), isNull(), isNull(), any(JobEnqueueMetadata.class));
    }

    private TenantRefreshJobProducer producer() {
        return new TenantRefreshJobProducer(
                provider,
                new ObjectMapper(),
                config,
                "rss-refresh",
                tenantId -> Map.of("tenantId", tenantId));
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<QueueService> providerOf(QueueService queueService) {
        ObjectProvider<QueueService> provider = mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(queueService);
        return provider;
    }
}
