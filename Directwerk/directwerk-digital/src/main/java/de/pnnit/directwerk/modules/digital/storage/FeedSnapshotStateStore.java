package de.pnnit.directwerk.modules.digital.storage;

import java.util.List;
import java.util.Locale;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

/**
 * JDBC store for generated-feed snapshot presence and leftover slug prefixes.
 * Avoids Hibernate tenant filters so platform tenant updates and queue jobs
 * can record state without a request {@code TenantContext}.
 */
@Repository
public class FeedSnapshotStateStore {

    public static final long TENANT_SUBJECT_ID = 0L;

    private final JdbcTemplate jdbcTemplate;

    public FeedSnapshotStateStore(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean isWritten(Long tenantId, String kind, long subjectId) {
        requireTenantId(tenantId);
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM rss_snapshot_presence
                WHERE tenant_id = ? AND kind = ? AND subject_id = ? AND stale = false
                """,
                Integer.class,
                tenantId,
                kind,
                subjectId
        );
        return count != null && count > 0;
    }

    public void markWritten(Long tenantId, String kind, long subjectId) {
        requireTenantId(tenantId);
        jdbcTemplate.update(
                """
                INSERT INTO rss_snapshot_presence (tenant_id, kind, subject_id, written_at, stale)
                VALUES (?, ?, ?, clock_timestamp(), false)
                ON CONFLICT (tenant_id, kind, subject_id)
                DO UPDATE SET written_at = EXCLUDED.written_at, stale = false
                """,
                tenantId,
                kind,
                subjectId
        );
    }

    /** True while a presence row exists, even if it is stale (invalidation pending a rebuild). */
    public boolean isKnown(Long tenantId, String kind, long subjectId) {
        requireTenantId(tenantId);
        Boolean known = jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1 FROM rss_snapshot_presence
                    WHERE tenant_id = ? AND kind = ? AND subject_id = ?
                )
                """,
                Boolean.class,
                tenantId,
                kind,
                subjectId
        );
        return Boolean.TRUE.equals(known);
    }

    /**
     * Marks every snapshot of the tenant stale. The rows stay so a reader is served not-ready
     * instead of the object built under the previous entitlements (#717).
     */
    public void markStale(Long tenantId) {
        requireTenantId(tenantId);
        jdbcTemplate.update("UPDATE rss_snapshot_presence SET stale = true WHERE tenant_id = ?", tenantId);
    }

    /** Marks one snapshot stale, creating the row when it is missing. */
    public void markStale(Long tenantId, String kind, long subjectId) {
        requireTenantId(tenantId);
        jdbcTemplate.update(
                """
                INSERT INTO rss_snapshot_presence (tenant_id, kind, subject_id, written_at, stale)
                VALUES (?, ?, ?, clock_timestamp(), true)
                ON CONFLICT (tenant_id, kind, subject_id)
                DO UPDATE SET stale = true
                """,
                tenantId,
                kind,
                subjectId
        );
    }

    public void clearWritten(Long tenantId) {
        requireTenantId(tenantId);
        jdbcTemplate.update("DELETE FROM rss_snapshot_presence WHERE tenant_id = ?", tenantId);
    }

    public void clearWritten(Long tenantId, String kind, long subjectId) {
        requireTenantId(tenantId);
        jdbcTemplate.update(
                """
                DELETE FROM rss_snapshot_presence
                WHERE tenant_id = ? AND kind = ? AND subject_id = ?
                """,
                tenantId,
                kind,
                subjectId
        );
    }

    public List<Long> writtenSubjectIds(Long tenantId, String kind) {
        requireTenantId(tenantId);
        return jdbcTemplate.query(
                """
                SELECT subject_id FROM rss_snapshot_presence
                WHERE tenant_id = ? AND kind = ? AND stale = false
                ORDER BY subject_id
                """,
                (rs, rowNum) -> rs.getLong("subject_id"),
                tenantId,
                kind
        );
    }

    public void recordStalePrefix(Long tenantId, String slug) {
        requireTenantId(tenantId);
        jdbcTemplate.update(
                """
                INSERT INTO rss_stale_prefixes (tenant_id, slug)
                VALUES (?, ?)
                ON CONFLICT (tenant_id, slug) DO NOTHING
                """,
                tenantId,
                requireSafeSlug(slug)
        );
    }

    public List<String> stalePrefixes(Long tenantId) {
        requireTenantId(tenantId);
        return jdbcTemplate.query(
                "SELECT slug FROM rss_stale_prefixes WHERE tenant_id = ?",
                (rs, rowNum) -> rs.getString("slug"),
                tenantId
        );
    }

    public void clearStalePrefix(Long tenantId, String slug) {
        requireTenantId(tenantId);
        jdbcTemplate.update(
                "DELETE FROM rss_stale_prefixes WHERE tenant_id = ? AND slug = ?",
                tenantId,
                requireSafeSlug(slug)
        );
    }

    private static void requireTenantId(Long tenantId) {
        if (tenantId == null || tenantId < 1) {
            throw new IllegalArgumentException("tenantId must be a positive id");
        }
    }

    private static String requireSafeSlug(String slug) {
        if (!StringUtils.hasText(slug)) {
            throw new IllegalArgumentException("slug is required");
        }
        String normalized = slug.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() > 64 || normalized.contains("/") || normalized.contains("..")) {
            throw new IllegalArgumentException("Invalid RSS stale prefix slug");
        }
        return normalized;
    }
}
