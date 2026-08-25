package de.pnnit.directwerk.modules.podcast.service;

public interface RssFeedRefreshScheduler {

    void requestRefreshAfterCommit(Long tenantId);
}
