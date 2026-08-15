package de.pnnit.directwerk.modules.queue;

/**
 * Processes jobs claimed from a named queue.
 */
public interface JobHandler {

    /**
     * @return the queue name this handler consumes
     */
    String queueName();

    /**
     * Processes a claimed queue job.
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
