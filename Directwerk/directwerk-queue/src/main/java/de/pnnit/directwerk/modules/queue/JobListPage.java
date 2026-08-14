package de.pnnit.directwerk.modules.queue;

import java.util.List;

/**
 * Paginated job list result for operational inspection.
 *
 * @param items  page of jobs
 * @param total  total matching rows (ignoring offset/limit)
 * @param offset requested offset
 * @param limit  requested page size
 */
public record JobListPage(
        List<QueueJob> items,
        long total,
        int offset,
        int limit
) {
}
