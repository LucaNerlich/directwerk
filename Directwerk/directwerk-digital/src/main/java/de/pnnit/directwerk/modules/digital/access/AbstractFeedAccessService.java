package de.pnnit.directwerk.modules.digital.access;

import de.pnnit.directwerk.modules.core.feed.AbstractFeed;
import java.util.List;
import java.util.Set;

/**
 * Entitlement checks shared by private content feeds.
 *
 * <p>Every feed answers the same three questions — what may this subscriber read on
 * this feed, what may they read for a chosen filter selection, and may they read one
 * item — and the only differences are the content type and its filter matcher. This
 * base keeps the entitlement composition in one place so a leak fix cannot land in
 * one feed kind only.</p>
 *
 * @param <CONTENT> the published content type
 * @param <FEED>    the module's concrete feed entity
 */
public abstract class AbstractFeedAccessService<CONTENT, FEED extends AbstractFeed> {

    /**
     * Every item this subscriber is entitled to, before the feed's filter applies.
     */
    protected abstract List<CONTENT> entitledContent(Long tenantId, Long userId);

    /**
     * Whether the feed's custom filter includes the content.
     */
    protected abstract boolean matchesFeed(FEED feed, CONTENT content);

    /**
     * Whether the content matches the subscriber's chosen filter selection.
     */
    protected abstract boolean matchesSelection(CONTENT content, Set<Long> selectionIds);

    /**
     * Whether the subscriber is entitled to the content at all.
     */
    protected abstract boolean hasContentAccess(Long tenantId, Long userId, CONTENT content);

    /**
     * Lists the entitled content the feed's filter includes.
     */
    public List<CONTENT> listEntitled(Long tenantId, Long userId, FEED feed) {
        return entitledContent(tenantId, userId).stream()
                .filter(content -> matchesFeed(feed, content))
                .toList();
    }

    /**
     * Lists the entitled content matching a filter selection.
     */
    public List<CONTENT> listEntitledForSelection(Long tenantId, Long userId, Set<Long> selectionIds) {
        return entitledContent(tenantId, userId).stream()
                .filter(content -> matchesSelection(content, selectionIds))
                .toList();
    }

    /**
     * Whether the subscriber may read the content through this feed.
     */
    public boolean hasAccess(Long tenantId, Long userId, FEED feed, CONTENT content) {
        return matchesFeed(feed, content) && hasContentAccess(tenantId, userId, content);
    }
}
