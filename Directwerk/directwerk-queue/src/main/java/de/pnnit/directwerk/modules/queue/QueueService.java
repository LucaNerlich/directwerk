package de.pnnit.directwerk.modules.queue;

import de.pnnit.directwerk.config.DirectwerkConfig;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

@Service
public class QueueService {

    private final QueueRepository repository;
    private final DirectwerkConfig directwerkConfig;
    private final JobHandlerRegistry handlerRegistry;

    public QueueService(
            QueueRepository repository,
            DirectwerkConfig directwerkConfig,
            JobHandlerRegistry handlerRegistry
    ) {
        this.repository = repository;
        this.directwerkConfig = directwerkConfig;
        this.handlerRegistry = handlerRegistry;
    }

    @Transactional
    public QueueJob enqueue(
            String queue,
            JsonNode payload,
            int priority,
            Instant availableAt,
            Integer maxAttempts
    ) {
        return enqueue(queue, payload, priority, availableAt, maxAttempts, JobEnqueueMetadata.empty());
    }

    @Transactional
    public QueueJob enqueue(
            String queue,
            JsonNode payload,
            int priority,
            Instant availableAt,
            Integer maxAttempts,
            JobEnqueueMetadata metadata
    ) {
        validateQueueName(queue);
        validateJson(payload);
        JobHandlerSettings handlerSettings = handlerRegistry.settingsFor(queue);
        int attempts = maxAttempts == null
                ? resolveDefaultMaxAttempts(handlerSettings)
                : maxAttempts;
        if (attempts < 1 || attempts > 100) {
            throw new IllegalArgumentException("maxAttempts must be between 1 and 100");
        }
        JobEnqueueMetadata safeMetadata = metadata == null ? JobEnqueueMetadata.empty() : metadata;
        if (safeMetadata.metadata() != null) {
            validateJson(safeMetadata.metadata());
        }
        // Matching QUEUED correlation ids are reused so producers can enqueue after every
        // mutation without stacking identical work. PROCESSING jobs are not coalesced.
        return repository.enqueue(
                queue,
                payload,
                priority,
                availableAt,
                attempts,
                safeMetadata.tenantId(),
                safeMetadata.correlationId(),
                safeMetadata.metadata()
        );
    }

    @Transactional
    public List<QueueJob> claim(String queue, String worker, int limit, long leaseSeconds) {
        validateQueueName(queue);
        var properties = directwerkConfig.queue();
        if (limit < 1 || limit > properties.claimLimit()) {
            throw new IllegalArgumentException(
                    "Claim limit %d exceeds configured claim limit %d.".formatted(limit, properties.claimLimit())
            );
        }
        long effectiveLeaseSeconds = resolveLeaseSeconds(queue, leaseSeconds);
        if (effectiveLeaseSeconds < 1 || effectiveLeaseSeconds > properties.maxLeaseSeconds()) {
            throw new IllegalArgumentException("Queue lease exceeds the configured safe range.");
        }
        return repository.claim(queue, worker, limit, Duration.ofSeconds(effectiveLeaseSeconds));
    }

    @Transactional(readOnly = true)
    public QueueJob get(UUID id) {
        return repository.find(id).orElseThrow(() -> new JobNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public JobListPage list(JobListQuery query) {
        if (query.offset() < 0) {
            throw new IllegalArgumentException("offset must be >= 0");
        }
        int maxLimit = Math.max(1, directwerkConfig.queue().listLimit());
        if (query.limit() < 1 || query.limit() > maxLimit) {
            throw new IllegalArgumentException(
                    "limit %d exceeds configured list limit %d.".formatted(query.limit(), maxLimit)
            );
        }
        if (query.updatedAfter() != null
                && query.updatedBefore() != null
                && !query.updatedAfter().isBefore(query.updatedBefore())) {
            throw new IllegalArgumentException("updatedAfter must be before updatedBefore");
        }
        if (query.queue() != null) {
            validateQueueName(query.queue());
        }
        return repository.list(query);
    }

    @Transactional
    public QueueJob complete(UUID id, String worker) {
        return repository.complete(id, worker)
                .orElseThrow(() -> new JobConflictException(
                        "Job is not actively leased by worker '%s'.".formatted(worker)
                ));
    }

    /**
     * Extends the lease of a processing job held by the specified worker. Used
     * as a heartbeat by {@link QueueWorker} so long-running handlers are not
     * re-claimed (and re-executed) by another node while still running.
     *
     * @param id the job identifier
     * @param worker the worker holding the job lease
     * @param extensionSeconds how much longer the lease should run from now
     * @return the updated job, or an empty optional if the lease was lost
     */
    @Transactional
    public Optional<QueueJob> renew(UUID id, String worker, long extensionSeconds) {
        return repository.renew(id, worker, Duration.ofSeconds(extensionSeconds));
    }

    @Transactional
    public QueueJob fail(UUID id, String worker, String error, long retryDelaySeconds) {
        QueueJob job = get(id);
        return fail(job, worker, error, retryDelaySeconds);
    }

    @Transactional
    public QueueJob fail(QueueJob job, String worker, String error, long retryDelaySeconds) {
        var properties = directwerkConfig.queue();
        long effectiveRetryDelay = resolveRetryDelaySeconds(job.queue(), retryDelaySeconds);
        if (effectiveRetryDelay < 0 || effectiveRetryDelay > properties.maxRetryDelaySeconds()) {
            throw new IllegalArgumentException("Retry delay exceeds the configured safe range.");
        }
        return repository.fail(job.id(), worker, error, Duration.ofSeconds(effectiveRetryDelay))
                .orElseThrow(() -> new JobConflictException(
                        "Job is not actively leased by worker '%s'.".formatted(worker)
                ));
    }

    public long resolveLeaseSeconds(String queue, long requestedLeaseSeconds) {
        JobHandlerSettings settings = handlerRegistry.settingsFor(queue);
        if (settings.leaseSeconds() != null) {
            return settings.leaseSeconds();
        }
        if (requestedLeaseSeconds > 0) {
            return requestedLeaseSeconds;
        }
        return directwerkConfig.queue().leaseSeconds();
    }

    public long resolveRetryDelaySeconds(String queue, long requestedRetryDelaySeconds) {
        JobHandlerSettings settings = handlerRegistry.settingsFor(queue);
        if (settings.retryDelaySeconds() != null) {
            return settings.retryDelaySeconds();
        }
        if (requestedRetryDelaySeconds >= 0) {
            return requestedRetryDelaySeconds;
        }
        return directwerkConfig.queue().retryDelaySeconds();
    }

    private int resolveDefaultMaxAttempts(JobHandlerSettings handlerSettings) {
        if (handlerSettings.defaultMaxAttempts() != null) {
            return handlerSettings.defaultMaxAttempts();
        }
        return directwerkConfig.queue().defaultMaxAttempts();
    }

    private void validateQueueName(String queue) {
        if (queue == null || !handlerRegistry.isRegistered(queue)) {
            throw new IllegalArgumentException("Queue is not allowed: " + queue);
        }
    }

    private void validateJson(JsonNode value) {
        int limit = directwerkConfig.queue().jsonByteLimit();
        if (value.toString().getBytes(StandardCharsets.UTF_8).length > limit) {
            throw new IllegalArgumentException("Queue payload exceeds configured JSON byte limit.");
        }
    }
}
