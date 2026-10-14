package de.pnnit.directwerk.modules.core.util;

import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver;
import de.pnnit.directwerk.modules.core.service.TenantPublicHostResolver.HostPolicy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Resolves absolute feed URLs for studio, public site config, and RSS enclosure builders.
 */
@Component
@RequiredArgsConstructor
public class FeedUrlResolver {

    private final TenantPublicHostResolver tenantPublicHostResolver;

    /** Internal helper only — no caller outside this class (issue #358). */
    private String origin(String scheme, String serverName, int serverPort) {
        return PublicUrlBuilder.baseUrl(scheme, serverName, serverPort);
    }

    public String subscriberFeedUrl(
            Long tenantId,
            String requestedHostname,
            String scheme,
            int serverPort,
            String tenantSlug,
            String feedToken
    ) {
        String host = tenantPublicHostResolver.resolve(tenantId, requestedHostname, HostPolicy.TRUST_REQUEST);
        return FeedUrls.subscriberFeed(origin(scheme, host, serverPort), tenantSlug, feedToken);
    }

    public String seriesFeedUrl(String scheme, String serverName, int serverPort, String tenantSlug, String seriesSlug) {
        return FeedUrls.seriesFeed(origin(scheme, serverName, serverPort), tenantSlug, seriesSlug);
    }

    public String articleSubscriberFeedUrl(
            Long tenantId,
            String requestedHostname,
            String scheme,
            int serverPort,
            String tenantSlug,
            String feedToken
    ) {
        String host = tenantPublicHostResolver.resolve(tenantId, requestedHostname, HostPolicy.TRUST_REQUEST);
        return FeedUrls.articleSubscriberFeed(origin(scheme, host, serverPort), tenantSlug, feedToken);
    }
}
