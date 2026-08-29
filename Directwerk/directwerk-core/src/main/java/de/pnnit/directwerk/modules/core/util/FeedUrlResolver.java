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

    public String origin(String scheme, String serverName, int serverPort) {
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

    public String subscriberFeedUrl(String scheme, String serverName, int serverPort, String tenantSlug, String feedToken) {
        return FeedUrls.subscriberFeed(origin(scheme, serverName, serverPort), tenantSlug, feedToken);
    }

    public String tenantPodcastFeedUrl(String scheme, String serverName, int serverPort, String tenantSlug) {
        return FeedUrls.tenantPodcastFeed(origin(scheme, serverName, serverPort), tenantSlug);
    }

    public String seriesFeedUrl(String scheme, String serverName, int serverPort, String tenantSlug, String seriesSlug) {
        return FeedUrls.seriesFeed(origin(scheme, serverName, serverPort), tenantSlug, seriesSlug);
    }

    public String publicEnclosureUrl(String origin, String tenantSlug, String episodeSlug) {
        return FeedUrls.publicEnclosure(origin, tenantSlug, episodeSlug);
    }

    public String privateEnclosureUrl(String origin, String tenantSlug, String feedToken, String episodeSlug) {
        return FeedUrls.privateEnclosure(origin, tenantSlug, feedToken, episodeSlug);
    }
}
