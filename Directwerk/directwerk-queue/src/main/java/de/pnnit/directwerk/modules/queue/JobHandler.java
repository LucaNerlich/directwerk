package de.pnnit.directwerk.modules.queue;

/**
 * Processes jobs claimed from a named queue.
 *
 * <p>Lease contract: while {@code handle} runs, the worker heartbeats the lease. If another
 * instance re-claims the job, {@link JobLeaseCancel#isCancelled()} becomes {@code true} and the
 * worker abandons the run (no {@code complete}/{@code fail}). Non-idempotent handlers must poll
 * that flag between side-effecting steps and return early when cancelled.
 */
public interface JobHandler {

    /**
     * @return the queue name this handler consumes
     */
    String queueName();

    /**
     * Processes a claimed queue job.
     *
     * <p>Poll {@link JobLeaseCancel#isCancelled()} during long or multi-step work; when true,
     * stop without further side effects — another worker owns the lease.
     *
     * @param job the leased job to process
     */
    void handle(QueueJob job);

    /**
     * Whether jobs on this queue must run within a tenant context.
     *
     * <p>Tenant-scoped queues fail closed: the worker rejects a job without a tenant id instead
     * of running it without tenant filtering. Override to {@code false} only for platform-scoped
     * queues that legitimately process null-tenant jobs.
     */
    default boolean requiresTenant() {
        return true;
    }

    /**
     * Optional per-queue processing overrides. Unset fields use global {@code directwerk.queue.*} values.
     */
    default JobHandlerSettings settings() {
        return JobHandlerSettings.defaults();
    }
}
