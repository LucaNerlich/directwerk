package de.pnnit.directwerk.modules.queue;

import java.time.Instant;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

public record QueueJob(
        UUID id,
        String queue,
        JsonNode payload,
        int priority,
        JobStatus status,
        Instant availableAt,
        int attempts,
        int maxAttempts,
        String lockedBy,
        Instant lockedUntil,
        String lastError,
        Long tenantId,
        String correlationId,
        JsonNode metadata,
        Instant createdAt,
        Instant updatedAt
) {
}
