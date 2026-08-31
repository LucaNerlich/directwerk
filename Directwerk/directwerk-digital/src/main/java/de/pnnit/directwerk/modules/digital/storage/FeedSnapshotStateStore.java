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
                WHERE tenant_id = ? AND kind = ? AND subject_id = ?
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
                INSERT INTO rss_snapshot_presence (tenant_id, kind, subject_id, written_at)
                VALUES (?, ?, ?, clock_timestamp())
                ON CONFLICT (tenant_id, kind, subject_id)
                DO UPDATE SET written_at = EXCLUDED.written_at
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
