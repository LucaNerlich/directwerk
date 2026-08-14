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
     * Optional per-queue processing overrides. Unset fields use global {@code directwerk.queue.*} values.
     */
    default JobHandlerSettings settings() {
        return JobHandlerSettings.defaults();
    }
}
