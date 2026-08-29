package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures every eligible tenant member has a default private {@code SubscriberFeed}.
 * The default feed is unfiltered and always lists every episode the user is entitled to hear.
 */
@Service
@RequiredArgsConstructor
public class SubscriberFeedProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(SubscriberFeedProvisioningService.class);

    private final SubscriberFeedService subscriberFeedService;
    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantModuleActivationRepository tenantModuleActivationRepository;
    private final ModuleGateService moduleGateService;

    @Transactional
    public void provisionDefaultFeed(Long tenantId, Long userId) {
        if (!isPrivateFeedModuleEnabled(tenantId)) {
            return;
        }
        subscriberFeedService.ensureDefaultFeed(tenantId, userId);
    }

    /**
     * Backfill path for memberships that pre-date feed provisioning or missed an event.
     *
     * @return number of default feeds created
     */
    @Transactional
    public int provisionMissingDefaultFeeds() {
        int created = 0;
        for (Long tenantId : tenantIdsEligibleForPrivateFeeds()) {
            created += provisionMissingDefaultFeeds(tenantId);
        }
        if (created > 0) {
            log.info("Provisioned {} missing default private feeds", created);
        }
        return created;
    }

    @Transactional
    public int provisionMissingDefaultFeeds(Long tenantId) {
        if (!isPrivateFeedModuleEnabled(tenantId)) {
            return 0;
        }
        int created = 0;
        for (Long userId : tenantMembershipRepository.findActiveUserIdsByTenantId(
                tenantId,
                MembershipStatus.ACTIVE
        )) {
            boolean alreadyExists = subscriberFeedService.hasDefaultFeed(tenantId, userId);
            if (!alreadyExists) {
                subscriberFeedService.ensureDefaultFeed(tenantId, userId);
                created++;
            }
        }
        return created;
    }

    private boolean isPrivateFeedModuleEnabled(Long tenantId) {
        return moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.PODCAST_RSS)
                && moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.SUBSCRIPTION);
    }

    private Set<Long> tenantIdsEligibleForPrivateFeeds() {
        List<Long> rssTenants = tenantModuleActivationRepository.findTenantIdsWithActiveModule(
                FeatureModuleKeys.PODCAST_RSS
        );
        List<Long> subscriptionTenants = tenantModuleActivationRepository.findTenantIdsWithActiveModule(
                FeatureModuleKeys.SUBSCRIPTION
        );
        Set<Long> eligible = new HashSet<>(rssTenants);
        eligible.retainAll(subscriptionTenants);
        return eligible;
    }
}
