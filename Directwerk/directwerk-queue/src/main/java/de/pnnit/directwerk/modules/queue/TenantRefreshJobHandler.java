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

    @Override
    public String queueName() {
        return queueName;
    }

    @Override
    public JobHandlerSettings settings() {
        return new JobHandlerSettings(900L, 60L, 8);
    }

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
