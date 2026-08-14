package de.pnnit.directwerk.modules.queue;

import org.springframework.util.StringUtils;
import tools.jackson.databind.JsonNode;

/**
 * Optional job metadata persisted alongside the payload for tracing and multi-tenancy.
 */
public record JobEnqueueMetadata(Long tenantId, String correlationId, JsonNode metadata) {

    public JobEnqueueMetadata {
        // Validate correlationId format and length
        if (correlationId != null) {
            if (!StringUtils.hasText(correlationId)) {
                throw new IllegalArgumentException("correlationId must not be blank");
            }
            if (correlationId.length() > 200) {
                throw new IllegalArgumentException("correlationId exceeds max length of 200");
            }
            // Enforce bounded, valid format (alphanumeric, hyphens, underscores)
            if (!correlationId.matches("^[a-zA-Z0-9_-]+$")) {
                throw new IllegalArgumentException("correlationId contains invalid characters (only alphanumeric, hyphen, underscore allowed)");
            }
        }
    }

    public static JobEnqueueMetadata empty() {
        return new JobEnqueueMetadata(null, null, null);
    }
}
