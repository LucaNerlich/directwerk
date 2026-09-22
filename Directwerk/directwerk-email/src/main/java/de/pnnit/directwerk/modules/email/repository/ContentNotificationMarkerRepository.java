package de.pnnit.directwerk.modules.email.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Per-content/per-recipient idempotency markers for content-notify fan-out.
 *
 * <p>The content-notify queue job can be retried after it already enqueued some recipient
 * email jobs (queue correlation coalescing only covers {@code QUEUED} jobs), so each
 * recipient is claimed exactly once before enqueueing. A retry skips already-claimed
 * recipients instead of sending a duplicate email.
 */
@Repository
public class ContentNotificationMarkerRepository {

    private final JdbcTemplate jdbcTemplate;

    public ContentNotificationMarkerRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /** Returns {@code true} when this recipient had not been notified yet and is now claimed. */
    public boolean claim(Long tenantId, String contentType, Long contentId, Long userId) {
        return jdbcTemplate.update("""
                INSERT INTO content_notification_markers (tenant_id, content_type, content_id, user_id)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (tenant_id, content_type, content_id, user_id) DO NOTHING
                """, tenantId, contentType, contentId, userId) > 0;
    }
}
