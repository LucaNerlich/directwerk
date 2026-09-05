package de.pnnit.directwerk.modules.queue;

import tools.jackson.databind.ObjectMapper;

import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Decodes a tenant-scoped job payload and delegates to a refresh action, rejecting jobs
 * without a positive tenant id.
 */
public class TenantRefreshJobHandler<T> implements JobHandler {

    private final ObjectMapper objectMapper;
    private final Class<T> payloadType;
    private final Function<T, Long> tenantId;
    private final String queueName;
    private final Consumer<Long> refresh;

    /**
     * Creates a handler for tenant-scoped refresh jobs.
     *
     * @param objectMapper the mapper used to convert job payloads
     * @param payloadType the payload class
     * @param tenantId the function that extracts a tenant ID from the payload
     * @param queueName the queue handled by this instance
     * @param refresh the action invoked with the extracted tenant ID
     */
    public TenantRefreshJobHandler(
            ObjectMapper objectMapper,
            Class<T> payloadType,
            Function<T, Long> tenantId,
            String queueName,
            Consumer<Long> refresh
    ) {
        this.objectMapper = objectMapper;
        this.payloadType = payloadType;
        this.tenantId = tenantId;
        this.queueName = queueName;
        this.refresh = refresh;
    }

    /**
     * Provides the queue name handled by this job handler.
     *
     * @return the configured queue name
     */
    @Override
    public String queueName() {
        return queueName;
    }

    /**
     * Provides the execution timeout, retry delay, and maximum retry count for this handler.
     *
     * @return the handler settings with a 900-second timeout, 60-second retry delay, and 8 retries
     */
    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(900L, 60L, 8);
    }

    /**
     * Processes a queued tenant refresh job.
     *
     * @param job the queued job containing the tenant-scoped payload
     * @throws IllegalArgumentException if the payload is null or has an invalid tenant ID
     */
    @Override
    public void handle(QueueJob job) {
        T payload = objectMapper.convertValue(job.payload(), payloadType);
        Long id = payload == null ? null : tenantId.apply(payload);
        if (id == null || id < 1) {
            throw new IllegalArgumentException("Invalid " + queueName + " job payload");
        }
        refresh.accept(id);
    }
}
