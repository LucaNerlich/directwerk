package de.pnnit.directwerk.modules.content;

import java.util.List;

/**
 * Port used by content-notify to resolve article newsletter recipients without
 * coupling {@code directwerk-email} to the newsletter module.
 */
public interface NewsletterNotifyAudienceApi {

    record Recipient(String email, String rawUnsubscribeToken) {
    }

    /**
     * ACTIVE subscriptions on lists attached to the article, deduped by email
     * (first list wins for unsubscribe token).
     */
    List<Recipient> findActiveRecipientsForArticle(Long tenantId, Long articleId);
}
