package de.pnnit.directwerk.modules.content;

import static org.assertj.core.api.Assertions.assertThat;

import de.pnnit.directwerk.multitenancy.TenantContext;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Issue #355: the shared per-tenant execution loop for both content workflows had no unit test
 * in the module that owns it — exactly where a tenant-context regression would leak across
 * tenants.
 */
class ScheduledPublishingTest {

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void runsEachItemInItsOwnTenantContext() {
        List<Long> seenTenantIds = new ArrayList<>();

        int processed = ScheduledPublishing.publishDue(
                List.of(
                        new ScheduledPublishing.DueItem(1L, 11L),
                        new ScheduledPublishing.DueItem(2L, 22L)),
                (tenantId, contentId) -> seenTenantIds.add(TenantContext.getTenantId()),
                "episodes"
        );

        assertThat(processed).isEqualTo(2);
        assertThat(seenTenantIds).containsExactly(1L, 2L);
        // The caller's context must be restored, not left on the last item's tenant.
        assertThat(TenantContext.getTenantId()).isNull();
    }

    @Test
    void oneThrowingItemDoesNotAbortTheBatchAndIsNotCounted() {
        List<Long> seenTenantIds = new ArrayList<>();

        int processed = ScheduledPublishing.publishDue(
                List.of(
                        new ScheduledPublishing.DueItem(1L, 11L),
                        new ScheduledPublishing.DueItem(2L, 22L),
                        new ScheduledPublishing.DueItem(3L, 33L)),
                (tenantId, contentId) -> {
                    if (contentId == 22L) {
                        throw new IllegalStateException("publish failed");
                    }
                    seenTenantIds.add(tenantId);
                },
                "episodes"
        );

        assertThat(processed).isEqualTo(2);
        assertThat(seenTenantIds).containsExactly(1L, 3L);
        assertThat(TenantContext.getTenantId()).isNull();
    }
}
