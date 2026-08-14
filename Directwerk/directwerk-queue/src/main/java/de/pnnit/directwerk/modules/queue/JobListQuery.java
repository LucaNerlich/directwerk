package de.pnnit.directwerk.modules.queue;

import java.time.Instant;

/**
 * Filters for listing jobs.
 *
 * @param queue         optional queue name exact match
 * @param status        optional status filter
 * @param updatedAfter  inclusive lower bound on {@code updated_at}
 * @param updatedBefore exclusive upper bound on {@code updated_at}
 * @param offset        zero-based offset
 * @param limit         page size
 */
public record JobListQuery(
        String queue,
        JobStatus status,
        Long tenantId,
        Instant updatedAfter,
        Instant updatedBefore,
        int offset,
        int limit
) {
}
