package de.pnnit.directwerk.modules.core.feed;

import de.pnnit.directwerk.modules.core.FeatureModuleKeys;
import de.pnnit.directwerk.modules.core.entity.MembershipStatus;
import de.pnnit.directwerk.modules.core.repository.TenantMembershipRepository;
import de.pnnit.directwerk.modules.core.repository.TenantModuleActivationRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Deep module for default private-feed provisioning.
 *
 * <p>Podcast feeds and article feeds run the identical workflow — module gate on
 * {@code <kind>_RSS} + {@code SUBSCRIPTION}, active-member scan, create-if-missing
 * backfill — and differ only in the feed module key and the concrete feed row.
 * The kind-specific row moves behind {@link DefaultFeedStore}; the workflow,
 * gating and backfill live here exactly once.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DefaultFeedProvisioningService {

    private final TenantMembershipRepository tenantMembershipRepository;
    private final TenantModuleActivationRepository tenantModuleActivationRepository;
    private final ModuleGateService moduleGateService;
    /**
     * Proxied self-reference: the per-tenant overload is {@code @Transactional}, and a plain
     * {@code this} call would never reach the proxy — the whole estate would share one
     * transaction and one failure would roll every tenant back (#715).
     */
    private final ObjectProvider<DefaultFeedProvisioningService> self;

    @Transactional
    public void provisionDefaultFeed(String feedModuleKey, Long tenantId, Long userId, DefaultFeedStore store) {
        if (!isPrivateFeedModuleEnabled(feedModuleKey, tenantId)) {
            return;
        }
        store.ensureDefaultFeed(tenantId, userId);
    }

    /**
     * Backfill path for memberships that pre-date feed provisioning or missed an event.
     *
     * @return number of default feeds created
     */
    public int provisionMissingDefaultFeeds(String feedModuleKey, DefaultFeedStore store) {
        int created = 0;
        for (Long tenantId : tenantIdsEligibleForPrivateFeeds(feedModuleKey)) {
            // The tenant set already intersects both module activations, so the per-tenant
            // re-check would only repeat the same two queries.
            created += self.getObject().provisionMissingDefaultFeedsForEligibleTenant(
                    feedModuleKey, tenantId, store);
        }
        if (created > 0) {
            log.info("Provisioned {} missing default private feeds for module {}", created, feedModuleKey);
        }
        return created;
    }

    @Transactional
    public int provisionMissingDefaultFeeds(String feedModuleKey, Long tenantId, DefaultFeedStore store) {
        if (!isPrivateFeedModuleEnabled(feedModuleKey, tenantId)) {
            return 0;
        }
        return provisionMissingDefaultFeedsForEligibleTenant(feedModuleKey, tenantId, store);
    }

    /** Per-tenant backfill for a tenant the caller already proved eligible. */
    @Transactional
    public int provisionMissingDefaultFeedsForEligibleTenant(
            String feedModuleKey, Long tenantId, DefaultFeedStore store) {
        int created = 0;
        for (Long userId : tenantMembershipRepository.findActiveUserIdsByTenantId(
                tenantId,
                MembershipStatus.ACTIVE
        )) {
            if (!store.hasDefaultFeed(tenantId, userId)) {
                store.ensureDefaultFeed(tenantId, userId);
                created++;
            }
        }
        return created;
    }

    private boolean isPrivateFeedModuleEnabled(String feedModuleKey, Long tenantId) {
        return moduleGateService.isModuleActive(tenantId, feedModuleKey)
                && moduleGateService.isModuleActive(tenantId, FeatureModuleKeys.SUBSCRIPTION);
    }

    private Set<Long> tenantIdsEligibleForPrivateFeeds(String feedModuleKey) {
        List<Long> rssTenants = tenantModuleActivationRepository.findTenantIdsWithActiveModule(feedModuleKey);
        List<Long> subscriptionTenants = tenantModuleActivationRepository.findTenantIdsWithActiveModule(
                FeatureModuleKeys.SUBSCRIPTION
        );
        Set<Long> eligible = new HashSet<>(rssTenants);
        eligible.retainAll(subscriptionTenants);
        return eligible;
    }
}
