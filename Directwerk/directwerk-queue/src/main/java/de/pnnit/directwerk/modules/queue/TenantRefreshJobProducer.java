package de.pnnit.directwerk.modules.queue;

import de.pnnit.directwerk.config.DirectwerkConfig;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.ObjectMapper;

import java.util.function.Function;

/** Enqueues a tenant-scoped refresh job only after the current transaction commits. */
public class TenantRefreshJobProducer {

    private final ObjectProvider<QueueService> queueService;
    private final ObjectMapper objectMapper;
    private final DirectwerkConfig directwerkConfig;
    private final String queueName;
    private final Function<Long, Object> payloadFactory;

    /**
     * Creates a producer for tenant-specific refresh jobs.
     *
     * @param queueName      the queue to which refresh jobs are submitted
     * @param payloadFactory creates a refresh-job payload for a tenant
     */
    public TenantRefreshJobProducer(
            ObjectProvider<QueueService> queueService,
            ObjectMapper objectMapper,
            DirectwerkConfig directwerkConfig,
            String queueName,
            Function<Long, Object> payloadFactory
    ) {
        this.queueService = queueService;
        this.objectMapper = objectMapper;
        this.directwerkConfig = directwerkConfig;
        this.queueName = queueName;
        this.payloadFactory = payloadFactory;
    }

    /**
     * Requests a refresh for a tenant after the current transaction commits.
     * If no transaction synchronization is active, the refresh is requested immediately.
     *
     * @param tenantId the positive identifier of the tenant to refresh
     * @throws IllegalArgumentException if {@code tenantId} is null or not positive
     */
    public void requestRefreshAfterCommit(Long tenantId) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("tenantId must be a positive id");
        }
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    requestRefresh(tenantId);
                }
            });
            return;
        }
        requestRefresh(tenantId);
    }

    private void requestRefresh(Long tenantId) {
        if (!directwerkConfig.isQueueEnabled()) {
            return;
        }
        queueService.getObject().enqueue(
                queueName,
                objectMapper.valueToTree(payloadFactory.apply(tenantId)),
                0,
                null,
                null,
                new JobEnqueueMetadata(tenantId, queueName + "-" + tenantId, null)
        );
    }
}
