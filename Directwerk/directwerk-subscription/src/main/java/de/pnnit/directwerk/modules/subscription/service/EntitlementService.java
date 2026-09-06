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
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
        return hasAccess(tenantId, userId, subject);
    }

    /**
     * Batch form of {@link #hasEpisodeAccess}: evaluates many episodes against ONE set of active
     * subscriptions and access rules. FREE subjects are granted without any query; paid subjects
     * share a single subscription fetch and a single rule fetch.
     */
    public Set<Long> filterAccessibleEpisodes(Long tenantId, Long userId, Map<Long, EpisodeAccessSubject> subjects) {
        return filterAccessible(tenantId, userId, subjects);
    }

    public boolean hasArticleAccess(Long tenantId, Long userId, ArticleAccessSubject subject) {
        return hasAccess(tenantId, userId, subject);
    }

    /**
     * Batch form of {@link #hasArticleAccess}: evaluates many articles against ONE set of active
     * subscriptions and access rules.
     */
    public Set<Long> filterAccessibleArticles(Long tenantId, Long userId, Map<Long, ArticleAccessSubject> subjects) {
        return filterAccessible(tenantId, userId, subjects);
    }

    public boolean hasDigitalAssetAccess(Long tenantId, Long userId, Long mediaAssetId) {
        return hasAccess(tenantId, userId, new DigitalAssetSubject(mediaAssetId));
    }

    /**
     * Batch form of {@link #hasDigitalAssetAccess}: one subscription fetch + one rule fetch,
     * then intersection with the candidate ids. Fail-closed: only explicitly granted ids return.
     */
    public Set<Long> filterAccessibleDigitalAssetIds(Long tenantId, Long userId, Collection<Long> mediaAssetIds) {
        if (mediaAssetIds.isEmpty()) {
            return Set.of();
        }
        Map<Long, ContentSubject> subjects = new LinkedHashMap<>();
        for (Long mediaAssetId : mediaAssetIds) {
            subjects.put(mediaAssetId, new DigitalAssetSubject(mediaAssetId));
        }
        return filterAccessible(tenantId, userId, subjects);
    }

    /**
     * The unified evaluation Seam of this Module: one decision procedure for every content kind.
     * Single checks are batch-of-one through the same fetch path, so single/batch parity holds
     * by construction — LEVEL evaluation, PACKAGE rule fetch, and FREE short-circuit happen
     * exactly once per call, shared across all subjects.
     */
    public boolean hasAccess(Long tenantId, Long userId, ContentSubject subject) {
        return filterAccessible(tenantId, userId, Map.of(0L, subject)).contains(0L);
    }

    public Set<Long> filterAccessible(
            Long tenantId, Long userId, Map<Long, ? extends ContentSubject> subjects) {
        if (subjects.isEmpty()) {
            return Set.of();
        }
        Set<Long> accessible = new HashSet<>();
        Map<Long, ContentSubject> paid = new LinkedHashMap<>();
        for (Map.Entry<Long, ? extends ContentSubject> entry : subjects.entrySet()) {
            if (entry.getValue().free()) {
                accessible.add(entry.getKey());
            } else {
                paid.put(entry.getKey(), entry.getValue());
            }
        }
        if (paid.isEmpty()) {
            return Set.copyOf(accessible);
        }

        List<Subscription> subscriptions = activeSubscriptions(tenantId, userId);
        OptionalInt maxLevelSortOrder = subscriptions.stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.LEVEL)
                .mapToInt(SubscriptionProduct::getSortOrder)
                .max();
        List<Long> packageProductIds = subscriptions.stream()
                .map(Subscription::getProduct)
                .filter(product -> product.getOfferingType() == OfferingType.PACKAGE)
                .map(SubscriptionProduct::getId)
                .toList();
        List<ProductAccessRule> rules = packageProductIds.isEmpty()
                ? List.of()
                : productAccessRuleRepository.findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(
                        tenantId, packageProductIds);

        for (Map.Entry<Long, ContentSubject> entry : paid.entrySet()) {
            ContentSubject subject = entry.getValue();
            if (levelGrants(maxLevelSortOrder, subject)
                    || rules.stream().anyMatch(rule -> grantedBy(rule, subject))) {
                accessible.add(entry.getKey());
            }
        }
        return Set.copyOf(accessible);
    }

    private boolean levelGrants(OptionalInt maxLevelSortOrder, ContentSubject subject) {
        return subject.levelApplies()
                && maxLevelSortOrder.isPresent()
                && maxLevelSortOrder.getAsInt() >= subject.requiredLevelSortOrder()
                && (subject.maxFormatRequiredLevel() == null
                        || maxLevelSortOrder.getAsInt() >= subject.maxFormatRequiredLevel());
    }

    private boolean grantedBy(ProductAccessRule rule, ContentSubject subject) {
        return switch (subject) {
            case EpisodeAccessSubject episode -> grantsEpisode(rule, episode);
            case ArticleAccessSubject article -> grantsArticle(rule, article);
            case DigitalAssetSubject asset -> grantsDigitalAsset(rule, asset);
        };
    }

    public List<Long> listEntitledDigitalAssetIds(Long tenantId, Long userId) {        List<Long> packageProductIds = activeSubscriptions(tenantId, userId).stream()
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

    private boolean grantsArticle(ProductAccessRule rule, ArticleAccessSubject subject) {
        return switch (rule.getScopeType()) {
            case CATEGORY -> subject.categoryIds().contains(rule.getScopeId());
            case ALL_PODCASTS, PODCAST_SERIES, FORMAT, DIGITAL_ASSET, FEED_BUILDER -> false;
        };
    }

    private boolean grantsDigitalAsset(ProductAccessRule rule, DigitalAssetSubject subject) {
        return rule.getScopeType() == ProductAccessScopeType.DIGITAL_ASSET
                && subject.mediaAssetId() != null
                && subject.mediaAssetId().equals(rule.getScopeId());
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

    /**
     * Subject model for the unified evaluation Seam. Every content kind answers the same
     * questions; kind-specific scope matching stays in the {@code grants*} methods above.
     */
    public sealed interface ContentSubject
            permits EpisodeAccessSubject, ArticleAccessSubject, DigitalAssetSubject {
        boolean free();

        int requiredLevelSortOrder();

        /** Format-level gate; null unless the kind supports it (episodes). */
        default Integer maxFormatRequiredLevel() {
            return null;
        }

        /** Standalone digital assets are PACKAGE-only; LEVEL never grants them. */
        default boolean levelApplies() {
            return true;
        }
    }

    public record EpisodeAccessSubject(
            boolean free,
            int requiredLevelSortOrder,
            Long seriesId,
            Set<Long> formatIds,
            Set<Long> categoryIds,
            Integer maxFormatRequiredLevel
    ) implements ContentSubject {
        public EpisodeAccessSubject {
            formatIds = formatIds == null ? Set.of() : Set.copyOf(formatIds);
            categoryIds = categoryIds == null ? Set.of() : Set.copyOf(categoryIds);
        }
    }

    public record ArticleAccessSubject(
            boolean free,
            int requiredLevelSortOrder,
            Set<Long> categoryIds
    ) implements ContentSubject {
        public ArticleAccessSubject {
            categoryIds = categoryIds == null ? Set.of() : Set.copyOf(categoryIds);
        }
    }

    public record DigitalAssetSubject(Long mediaAssetId) implements ContentSubject {
        @Override
        public boolean free() {
            return false;
        }

        @Override
        public int requiredLevelSortOrder() {
            return 0;
        }

        @Override
        public boolean levelApplies() {
            return false;
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
