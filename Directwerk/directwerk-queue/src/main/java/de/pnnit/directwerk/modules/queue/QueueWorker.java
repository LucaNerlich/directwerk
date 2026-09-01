package de.pnnit.directwerk.modules.queue;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.multitenancy.TenantContext;
import jakarta.annotation.PreDestroy;
import java.net.InetAddress;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
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

    /**
     * Single daemon thread shared by all running jobs — heartbeats are cheap
     * single-row UPDATEs and must never prevent JVM shutdown.
     */
    private final ScheduledExecutorService leaseHeartbeat =
            Executors.newSingleThreadScheduledExecutor(runnable -> {
                Thread thread = new Thread(runnable, "queue-lease-heartbeat");
                thread.setDaemon(true);
                return thread;
            });

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

    @PreDestroy
    void shutdownHeartbeat() {
        leaseHeartbeat.shutdownNow();
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

    private void process(JobHandler handler, QueueJob job) {
        ScheduledFuture<?> leaseHeartbeatTask = startLeaseHeartbeat(job);
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
            if (leaseHeartbeatTask != null) {
                leaseHeartbeatTask.cancel(false);
            }
            TenantContext.clear();
        }
    }

    /**
     * Periodically extends this worker's lease while the handler runs so a slow
     * SMTP relay or RSS refresh is not re-claimed and re-executed by another
     * node mid-flight. The renewal period is a third of the effective lease.
     */
    private ScheduledFuture<?> startLeaseHeartbeat(QueueJob job) {
        try {
            long leaseSeconds = queueService.resolveLeaseSeconds(
                    job.queue(),
                    directwerkConfig.queue().leaseSeconds()
            );
            long periodSeconds = Math.max(1, leaseSeconds / 3);
            return leaseHeartbeat.scheduleAtFixedRate(() -> {
                try {
                    queueService.renew(job.id(), workerId, leaseSeconds);
                } catch (JobConflictException conflict) {
                    // Lease was lost — another node owns the job now. Throwing
                    // suppresses further heartbeats; completion/failure of our
                    // run will be rejected as stale by the repository guards.
                    log.warn("Lease lost during execution: job id={} queue={}", job.id(), job.queue());
                    throw conflict;
                } catch (RuntimeException ex) {
                    // Transient DB problems must not kill the heartbeat.
                    log.warn("Could not renew lease for job id={} queue={}", job.id(), job.queue(), ex);
                }
            }, periodSeconds, periodSeconds, TimeUnit.SECONDS);
        } catch (RuntimeException schedulingFailure) {
            // Heartbeat is an optimization — never block job execution on it.
            log.warn("Lease heartbeat could not be scheduled for job id={} queue={}",
                    job.id(), job.queue(), schedulingFailure);
            return null;
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
