package de.pnnit.directwerk.modules.subscription.service;

import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessRule;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.ProductAccessRuleRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.OptionalInt;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EntitlementService {

    private final SubscriptionRepository subscriptionRepository;
    private final ProductAccessRuleRepository productAccessRuleRepository;

    public AccessSummary resolveAccess(Long tenantId, Long userId) {
        List<Subscription> activeSubscriptions = subscriptionRepository.findActiveWithProducts(
                tenantId,
                userId,
                SubscriptionStatus.ACTIVE
        ).stream()
                .filter(this::isCurrentlyActive)
                .toList();

        List<LevelEntitlement> activeLevels = activeSubscriptions.stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.LEVEL)
                .map(product -> new LevelEntitlement(
                        product.getId(),
                        product.getSlug(),
                        product.getTitle(),
                        product.getSortOrder()
                ))
                .toList();

        OptionalInt maxLevelSortOrder = activeLevels.stream()
                .mapToInt(LevelEntitlement::sortOrder)
                .max();

        List<PackageEntitlement> activePackages = activeSubscriptions.stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.PACKAGE)
                .map(product -> new PackageEntitlement(
                        product.getId(),
                        product.getSlug(),
                        product.getTitle()
                ))
                .toList();

        return new AccessSummary(
                activeLevels,
                maxLevelSortOrder.isPresent() ? maxLevelSortOrder.getAsInt() : null,
                activePackages
        );
    }

    public boolean hasLevelAtLeast(Long tenantId, Long userId, int minimumSortOrder) {
        AccessSummary access = resolveAccess(tenantId, userId);
        return access.maxLevelSortOrder() != null && access.maxLevelSortOrder() >= minimumSortOrder;
    }

    public boolean hasEpisodeAccess(Long tenantId, Long userId, EpisodeAccessSubject subject) {
        if (subject.free()) {
            return true;
        }

        List<Subscription> activeSubscriptions = activeSubscriptions(tenantId, userId);
        OptionalInt maxLevelSortOrder = activeSubscriptions.stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.LEVEL)
                .mapToInt(product -> product.getSortOrder())
                .max();
        if (maxLevelSortOrder.isPresent()
                && maxLevelSortOrder.getAsInt() >= subject.requiredLevelSortOrder()
                && (subject.maxFormatRequiredLevel() == null
                        || maxLevelSortOrder.getAsInt() >= subject.maxFormatRequiredLevel())) {
            return true;
        }

        List<Long> packageProductIds = activeSubscriptions.stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.PACKAGE)
                .map(product -> product.getId())
                .toList();
        if (packageProductIds.isEmpty()) {
            return false;
        }

        return productAccessRuleRepository
                .findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(tenantId, packageProductIds)
                .stream()
                .anyMatch(rule -> grantsEpisode(rule, subject));
    }

    public boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId) {
        List<Long> packageProductIds = activeSubscriptions(tenantId, userId).stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.PACKAGE)
                .map(product -> product.getId())
                .toList();
        if (packageProductIds.isEmpty()) {
            return false;
        }

        return productAccessRuleRepository
                .findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(tenantId, packageProductIds)
                .stream()
                .anyMatch(rule -> rule.getScopeType() == ProductAccessScopeType.DIGITAL_ASSET
                        && mediaAssetId.equals(rule.getScopeId()));
    }

    public List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId) {
        List<Long> packageProductIds = activeSubscriptions(tenantId, userId).stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.PACKAGE)
                .map(SubscriptionProduct::getId)
                .toList();
        if (packageProductIds.isEmpty()) {
            return List.of();
        }

        return productAccessRuleRepository
                .findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(tenantId, packageProductIds)
                .stream()
                .filter(rule -> rule.getScopeType() == ProductAccessScopeType.DIGITAL_ASSET)
                .map(ProductAccessRule::getScopeId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private boolean grantsEpisode(ProductAccessRule rule, EpisodeAccessSubject subject) {
        return switch (rule.getScopeType()) {
            case ALL_PODCASTS -> true;
            case PODCAST_SERIES -> subject.seriesId() != null && subject.seriesId().equals(rule.getScopeId());
            case FORMAT -> subject.formatIds().contains(rule.getScopeId());
            case CATEGORY -> subject.categoryIds().contains(rule.getScopeId());
            case DIGITAL_ASSET, FEED_BUILDER -> false;
        };
    }

    private List<Subscription> activeSubscriptions(Long tenantId, Long userId) {
        return subscriptionRepository.findActiveWithProducts(
                tenantId,
                userId,
                SubscriptionStatus.ACTIVE
        ).stream()
                .filter(this::isCurrentlyActive)
                .toList();
    }

    private boolean isCurrentlyActive(Subscription subscription) {
        Instant endsAt = subscription.getEndsAt();
        return endsAt == null || endsAt.isAfter(Instant.now());
    }

    public record EpisodeAccessSubject(
            boolean free,
            int requiredLevelSortOrder,
            Long seriesId,
            Set<Long> formatIds,
            Set<Long> categoryIds,
            Integer maxFormatRequiredLevel
    ) {
        public EpisodeAccessSubject {
            formatIds = formatIds == null ? Set.of() : Set.copyOf(formatIds);
            categoryIds = categoryIds == null ? Set.of() : Set.copyOf(categoryIds);
        }
    }

    public record LevelEntitlement(Long id, String slug, String title, int sortOrder) {
    }

    public record PackageEntitlement(Long id, String slug, String title) {
    }

    public record AccessSummary(
            List<LevelEntitlement> activeLevels,
            Integer maxLevelSortOrder,
            List<PackageEntitlement> activePackages
    ) {
    }
}
