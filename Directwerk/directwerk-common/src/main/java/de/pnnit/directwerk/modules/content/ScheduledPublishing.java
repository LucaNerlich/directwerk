package de.pnnit.directwerk.modules.content;

import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.List;
import java.util.function.BiConsumer;
import lombok.extern.slf4j.Slf4j;

/**
 * Shared due-scheduled publishing loop: per-tenant context, error isolation and counting.
 * Both content workflows run the identical loop — one implementation so a fix (e.g. to
 * tenant context handling) lands everywhere. Callers supply the per-item work including any
 * module gating (module keys differ per content type).
 */
@Slf4j
public final class ScheduledPublishing {

    private ScheduledPublishing() {
    }

    /** A due scheduled item: its owning tenant and content id. */
    public record DueItem(Long tenantId, Long contentId) {
    }

    /**
     * Publishes every due item in its own tenant context; failures are logged and skipped
     * so one broken item cannot block the rest.
     * <p>
     * Issue #353: the returned count is the number of items <em>processed without error</em>,
     * not the number actually published — a handler that returns early on a skip (status
     * changed, permission denied) still counts. The doc said "successfully published", which
     * disagreed with the behaviour; both Quartz jobs discard the value.
     *
     * @return the number of items processed without error
     */
    public static int publishDue(
            List<DueItem> dueItems,
            BiConsumer<Long, Long> publishOne,
            String contentTypeLabel
    ) {
        int processed = 0;
        for (DueItem item : dueItems) {
            try {
                TenantContext.runWithTenant(item.tenantId(), () ->
                        publishOne.accept(item.tenantId(), item.contentId()));
                processed++;
            } catch (Exception ex) {
                log.error("Failed to publish scheduled {} tenant={} id={}",
                        contentTypeLabel, item.tenantId(), item.contentId(), ex);
            }
        }
        return processed;
    }
}
