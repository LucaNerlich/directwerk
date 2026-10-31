package de.pnnit.directwerk.modules.email.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Per-content/per-recipient idempotency markers for content-notify fan-out.
 *
 * <p>Markers are claimed only after a successful email-job enqueue so a disabled mailer
 * (null enqueue) cannot stick a recipient and block Studio retry. A content-notify retry
 * skips already-claimed recipients via {@link #exists} / {@link #existsNewsletterRecipient}.
 */
@Repository
public class ContentNotificationMarkerRepository {

    private final JdbcTemplate jdbcTemplate;

    public ContentNotificationMarkerRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean exists(Long tenantId, String contentType, Long contentId, Long userId) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM content_notification_markers
                WHERE tenant_id = ? AND content_type = ? AND content_id = ? AND user_id = ?
                """, Integer.class, tenantId, contentType, contentId, userId);
        return count != null && count > 0;
    }

    /** Returns {@code true} when this recipient had not been notified yet and is now claimed. */
    public boolean claim(Long tenantId, String contentType, Long contentId, Long userId) {
        return jdbcTemplate.update("""
                INSERT INTO content_notification_markers (tenant_id, content_type, content_id, user_id)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (tenant_id, content_type, content_id, user_id) DO NOTHING
                """, tenantId, contentType, contentId, userId) > 0;
    }

    /** Clears all episode-member markers for one content item (Studio retry recovery). */
    public int clearForContent(Long tenantId, String contentType, Long contentId) {
        return jdbcTemplate.update("""
                DELETE FROM content_notification_markers
                WHERE tenant_id = ? AND content_type = ? AND content_id = ?
                """, tenantId, contentType, contentId);
    }

    public boolean existsNewsletterRecipient(Long tenantId, Long contentId, String recipientEmail) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM newsletter_notification_markers
                WHERE tenant_id = ? AND content_id = ? AND recipient_email = ?
                """, Integer.class, tenantId, contentId, recipientEmail);
        return count != null && count > 0;
    }

    /**
     * Claims one article-newsletter recipient address (issue #539).
     *
     * <p>Newsletter recipients are identified by email, not by user id, so they use their own
     * marker table; a retried CONTENT_NOTIFY job skips addresses that were already enqueued.</p>
     *
     * @return {@code true} when this address had not been claimed yet
     */
    public boolean claimNewsletterRecipient(Long tenantId, Long contentId, String recipientEmail) {
        return jdbcTemplate.update("""
                INSERT INTO newsletter_notification_markers (tenant_id, content_id, recipient_email)
                VALUES (?, ?, ?)
                ON CONFLICT (tenant_id, content_id, recipient_email) DO NOTHING
                """, tenantId, contentId, recipientEmail) > 0;
    }

    /** Clears all newsletter markers for one article (Studio retry recovery). */
    public int clearNewsletterForContent(Long tenantId, Long contentId) {
        return jdbcTemplate.update("""
                DELETE FROM newsletter_notification_markers
                WHERE tenant_id = ? AND content_id = ?
                """, tenantId, contentId);
    }
}
