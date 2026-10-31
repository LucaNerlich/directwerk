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
            // One broken queue (misconfigured lease, transient claim failure) must not
            // starve every queue that happens to be polled after it.
            try {
                poll(queueName);
            } catch (RuntimeException ex) {
                log.error("Polling queue={} failed; continuing with the remaining queues", queueName, ex);
            }
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
        // Issue #327: the batch is claimed up front but processed serially, so the leases of the
        // later jobs keep ticking from claim time. Renew this job's lease before running it; an
        // empty result means it was already re-claimed by another worker, so skip rather than
        // execute it concurrently.
        long leaseSeconds = queueService.resolveLeaseSeconds(job.queue(), directwerkConfig.queue().leaseSeconds());
        if (queueService.renew(job.id(), workerId, leaseSeconds).isEmpty()) {
            log.warn("Skipping job id={} queue={} — lease was lost before execution", job.id(), job.queue());
            return;
        }
        try (JobLeaseCancel.Scope cancel = JobLeaseCancel.open()) {
            ScheduledFuture<?> leaseHeartbeatTask = startLeaseHeartbeat(job, cancel);
            try {
                if (handler.requiresTenant() && job.tenantId() == null) {
                    throw new IllegalStateException(
                            "Job requires a tenant but none is set (queue=" + job.queue() + ", id=" + job.id() + ")");
                }
                TenantContext.runWithTenant(job.tenantId(), () -> handler.handle(job));
                if (cancel.isLost()) {
                    log.warn(
                            "Abandoning job id={} queue={} after lease loss (no complete)",
                            job.id(),
                            job.queue()
                    );
                    return;
                }
                queueService.complete(job.id(), workerId);
                log.info("Completed job id={} queue={}", job.id(), job.queue());
            } catch (Exception ex) {
                if (cancel.isLost()) {
                    log.warn(
                            "Abandoning job id={} queue={} after lease loss (no fail): {}",
                            job.id(),
                            job.queue(),
                            ex.getMessage()
                    );
                    return;
                }
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
    }

    /**
     * One scheduled heartbeat tick: renew the lease and stop the heartbeat on loss.
     *
     * <p>Throwing suppresses further firings. Setting the cancel scope marks the handler run for
     * cooperative abort so {@code complete}/{@code fail} are not attempted on a re-claimed job.
     */
    void heartbeatTick(QueueJob job, long leaseSeconds, JobLeaseCancel.Scope cancel) {
        if (!renewLeaseOnce(job, leaseSeconds)) {
            cancel.markLost();
            log.warn("Lease lost during execution: job id={} queue={}", job.id(), job.queue());
            throw new IllegalStateException("lease lost");
        }
    }

    /**
     * Runs one heartbeat renewal and reports whether this worker still owns the lease.
     *
     * <p>Issue #583: {@code renew} signals a lost lease with an empty Optional (it never throws
     * {@code JobConflictException}), so the old throwing catch was unreachable and mid-execution
     * lease loss went unlogged. Transient DB failures count as "still alive" so the heartbeat is
     * not killed by a blip.</p>
     */
    boolean renewLeaseOnce(QueueJob job, long leaseSeconds) {
        try {
            return queueService.renew(job.id(), workerId, leaseSeconds).isPresent();
        } catch (RuntimeException ex) {
            log.warn("Could not renew lease for job id={} queue={}", job.id(), job.queue(), ex);
            return true;
        }
    }

    /**
     * Periodically extends this worker's lease while the handler runs so a slow
     * SMTP relay or RSS refresh is not re-claimed and re-executed by another
     * node mid-flight. The renewal period is a third of the effective lease.
     */
    private ScheduledFuture<?> startLeaseHeartbeat(QueueJob job, JobLeaseCancel.Scope cancel) {
        try {
            long leaseSeconds = queueService.resolveLeaseSeconds(
                    job.queue(),
                    directwerkConfig.queue().leaseSeconds()
            );
            long periodSeconds = Math.max(1, leaseSeconds / 3);
            return leaseHeartbeat.scheduleAtFixedRate(
                    () -> heartbeatTick(job, leaseSeconds, cancel),
                    periodSeconds,
                    periodSeconds,
                    TimeUnit.SECONDS
            );
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
