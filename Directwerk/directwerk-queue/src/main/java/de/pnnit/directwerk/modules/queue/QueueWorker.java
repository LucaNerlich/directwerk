package de.pnnit.directwerk.modules.queue;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.multitenancy.TenantContext;
import java.net.InetAddress;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Claims jobs for registered handlers and dispatches them in-process.
 * Restores {@link TenantContext} from {@link QueueJob#tenantId()} for each job.
 */
@Component
public class QueueWorker {

    private static final Logger log = LoggerFactory.getLogger(QueueWorker.class);

    private final QueueService queueService;
    private final DirectwerkConfig directwerkConfig;
    private final JobHandlerRegistry handlerRegistry;
    private final String workerId;

    public QueueWorker(
            QueueService queueService,
            DirectwerkConfig directwerkConfig,
            JobHandlerRegistry handlerRegistry
    ) {
        this.queueService = queueService;
        this.directwerkConfig = directwerkConfig;
        this.handlerRegistry = handlerRegistry;
        this.workerId = directwerkConfig.isQueueEnabled()
                ? resolveWorkerId(directwerkConfig.queue().workerId())
                : resolveWorkerId(null);
    }

    public String workerId() {
        return workerId;
    }

    public void pollAll() {
        if (!directwerkConfig.isQueueEnabled()) {
            return;
        }
        for (String queueName : handlerRegistry.registeredQueues()) {
            poll(queueName);
        }
    }

    public void poll(String queueName) {
        if (!directwerkConfig.isQueueEnabled()) {
            return;
        }
        JobHandler handler = handlerRegistry.handlerFor(queueName);
        if (handler == null) {
            log.warn("No handler registered for queue={}", queueName);
            return;
        }

        var properties = directwerkConfig.queue();
        long leaseSeconds = queueService.resolveLeaseSeconds(queueName, properties.leaseSeconds());
        List<QueueJob> claimed = queueService.claim(
                queueName,
                workerId,
                properties.claimLimit(),
                leaseSeconds
        );
        for (QueueJob job : claimed) {
            process(handler, job);
        }
    }

    /**
     * Executes a queued job within its tenant context and records its completion or failure.
     *
     * @param handler the handler responsible for processing the job
     * @param job     the queued job to process
     */
    private void process(JobHandler handler, QueueJob job) {
        try {
            if (handler.requiresTenant() && job.tenantId() == null) {
                throw new IllegalStateException(
                        "Job requires a tenant but none is set (queue=" + job.queue() + ", id=" + job.id() + ")");
            }
            TenantContext.runWithTenant(job.tenantId(), () -> handler.handle(job));
            queueService.complete(job.id(), workerId);
            log.info("Completed job id={} queue={}", job.id(), job.queue());
        } catch (Exception ex) {
            String message = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
            String error = message.length() > 2000 ? message.substring(0, 2000) : message;
            try {
                long retryDelaySeconds = queueService.resolveRetryDelaySeconds(
                        job.queue(),
                        directwerkConfig.queue().retryDelaySeconds()
                );
                QueueJob result = queueService.fail(job, workerId, error, retryDelaySeconds);
                log.warn(
                        "Failed job id={} queue={} status={} attempts={}",
                        job.id(),
                        job.queue(),
                        result.status(),
                        result.attempts()
                );
            } catch (JobConflictException conflict) {
                log.warn("Could not fail job id={} (lease lost): {}", job.id(), conflict.getMessage());
            }
        } finally {
            TenantContext.clear();
        }
    }

    private static String resolveWorkerId(String configured) {
        if (configured != null && !configured.isBlank()) {
            return configured.trim();
        }
        String host;
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (Exception ex) {
            host = "unknown";
        }
        return "directwerk-%s-%s".formatted(host, UUID.randomUUID());
    }
}
