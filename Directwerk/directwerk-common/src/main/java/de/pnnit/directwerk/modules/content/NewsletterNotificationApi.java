package de.pnnit.directwerk.modules.content;

/**
 * Delivery seam for article newsletters.
 *
 * <p>The newsletter module owns the whole delivery: resolving active subscribers
 * across the article's lists, per-recipient unsubscribe scope, token lifecycle
 * and the email enqueue. Callers (content-notify) hand over the publication and
 * do not need to know about tokens, URLs or recipient dedupe.
 */
public interface NewsletterNotificationApi {

    /**
     * Fan out the published-article newsletter to every active subscriber.
     * No-op when the article has no active lists or no active subscribers.
     */
    void notifyArticlePublished(ContentPublishedEvent event);
}
