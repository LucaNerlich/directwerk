package de.pnnit.directwerk.modules.newsletter.service;

public interface ArticleRssFeedRefreshScheduler {

    void requestRefreshAfterCommit(Long tenantId);
}
