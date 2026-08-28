package de.pnnit.directwerk.modules.podcast.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Ensures default SubscriberFeed exists when subscription membership activates.
 */
@Service
@RequiredArgsConstructor
public class SubscriberFeedProvisioningService {

    private final SubscriberFeedService subscriberFeedService;

    public void provisionOnMembershipActivated(Long tenantId, Long userId) {
        subscriberFeedService.ensureDefaultFeed(tenantId, userId);
    }
}
