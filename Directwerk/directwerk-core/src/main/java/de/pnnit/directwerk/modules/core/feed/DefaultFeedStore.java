package de.pnnit.directwerk.modules.core.feed;

/**
 * The per-content-kind half of default-feed provisioning: whether a member
 * already has their default feed, and how to create it. Implemented by the
 * podcast and article feed services (or a thin adapter over them).
 */
public interface DefaultFeedStore {

    boolean hasDefaultFeed(Long tenantId, Long userId);

    void ensureDefaultFeed(Long tenantId, Long userId);
}
