package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessRule;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.ProductAccessRuleRepository;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EntitlementServiceTest {

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private ProductAccessRuleRepository productAccessRuleRepository;

    @InjectMocks
    private EntitlementService entitlementService;

    @Test
    void resolveAccessReturnsHighestActiveLevelSortOrder() {
        SubscriptionProduct producer = product(2L, "producer", 2);

        Subscription subscription = new Subscription();
        subscription.setProduct(producer);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setEndsAt(null);

        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));

        EntitlementService.AccessSummary summary = entitlementService.resolveAccess(10L, 20L);

        assertThat(summary.maxLevelSortOrder()).isEqualTo(2);
        assertThat(summary.activeLevels()).hasSize(1);
        assertThat(summary.activeLevels().getFirst().slug()).isEqualTo("producer");
    }

    @Test
    void hasLevelAtLeastUsesSortOrderLadder() {
        SubscriptionProduct supporter = product(1L, "supporter", 1);
        Subscription subscription = new Subscription();
        subscription.setProduct(supporter);
        subscription.setStatus(SubscriptionStatus.ACTIVE);

        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));

        assertThat(entitlementService.hasLevelAtLeast(10L, 20L, 1)).isTrue();
        assertThat(entitlementService.hasLevelAtLeast(10L, 20L, 2)).isFalse();
    }

    @Test
    void hasEpisodeAccessAllowsFreeSubjectWithoutSubscriptions() {
        EntitlementService.EpisodeAccessSubject subject = new EntitlementService.EpisodeAccessSubject(
                true,
                3,
                30L,
                Set.of(40L),
                Set.of(50L),
                4
        );

        assertThat(entitlementService.hasEpisodeAccess(10L, 20L, subject)).isTrue();
    }

    @Test
    void hasEpisodeAccessUsesLevelAndFormatRequirement() {
        SubscriptionProduct producer = product(2L, "producer", 3);
        Subscription subscription = activeSubscription(producer);
        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));

        EntitlementService.EpisodeAccessSubject allowed = new EntitlementService.EpisodeAccessSubject(
                false,
                2,
                30L,
                Set.of(40L),
                Set.of(),
                3
        );
        EntitlementService.EpisodeAccessSubject denied = new EntitlementService.EpisodeAccessSubject(
                false,
                2,
                30L,
                Set.of(40L),
                Set.of(),
                4
        );

        assertThat(entitlementService.hasEpisodeAccess(10L, 20L, allowed)).isTrue();
        assertThat(entitlementService.hasEpisodeAccess(10L, 20L, denied)).isFalse();
    }

    @Test
    void hasEpisodeAccessUsesPackageFormatGrant() {
        SubscriptionProduct packageProduct = product(9L, "format-package", 0);
        packageProduct.setOfferingType(OfferingType.PACKAGE);
        Subscription subscription = activeSubscription(packageProduct);
        ProductAccessRule rule = rule(packageProduct, ProductAccessScopeType.FORMAT, 40L);

        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));
        when(productAccessRuleRepository.findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(10L, List.of(9L)))
                .thenReturn(List.of(rule));

        EntitlementService.EpisodeAccessSubject subject = new EntitlementService.EpisodeAccessSubject(
                false,
                10,
                30L,
                Set.of(40L),
                Set.of(),
                null
        );

        assertThat(entitlementService.hasEpisodeAccess(10L, 20L, subject)).isTrue();
    }

    @Test
    void hasArticleAccessAllowsFreeSubjectWithoutSubscriptions() {
        EntitlementService.ArticleAccessSubject subject = new EntitlementService.ArticleAccessSubject(
                true,
                3,
                Set.of(50L)
        );

        assertThat(entitlementService.hasArticleAccess(10L, 20L, subject)).isTrue();
    }

    @Test
    void hasArticleAccessUsesLevelSortOrder() {
        SubscriptionProduct supporter = product(1L, "supporter", 1);
        Subscription subscription = activeSubscription(supporter);
        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));

        EntitlementService.ArticleAccessSubject allowed = new EntitlementService.ArticleAccessSubject(
                false,
                1,
                Set.of()
        );
        EntitlementService.ArticleAccessSubject denied = new EntitlementService.ArticleAccessSubject(
                false,
                2,
                Set.of()
        );

        assertThat(entitlementService.hasArticleAccess(10L, 20L, allowed)).isTrue();
        assertThat(entitlementService.hasArticleAccess(10L, 20L, denied)).isFalse();
    }

    @Test
    void hasArticleAccessUsesPackageCategoryGrant() {
        SubscriptionProduct packageProduct = product(9L, "category-package", 0);
        packageProduct.setOfferingType(OfferingType.PACKAGE);
        Subscription subscription = activeSubscription(packageProduct);
        ProductAccessRule rule = rule(packageProduct, ProductAccessScopeType.CATEGORY, 50L);

        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));
        when(productAccessRuleRepository.findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(10L, List.of(9L)))
                .thenReturn(List.of(rule));

        EntitlementService.ArticleAccessSubject subject = new EntitlementService.ArticleAccessSubject(
                false,
                10,
                Set.of(50L)
        );

        assertThat(entitlementService.hasArticleAccess(10L, 20L, subject)).isTrue();
    }

    @Test
    void listEntitledDigitalAssetIdsReturnsDistinctPackageScopes() {
        SubscriptionProduct packageProduct = product(9L, "bonus-pack", 0);
        packageProduct.setOfferingType(OfferingType.PACKAGE);
        Subscription subscription = activeSubscription(packageProduct);
        ProductAccessRule first = rule(packageProduct, ProductAccessScopeType.DIGITAL_ASSET, 71L);
        ProductAccessRule duplicate = rule(packageProduct, ProductAccessScopeType.DIGITAL_ASSET, 71L);
        ProductAccessRule second = rule(packageProduct, ProductAccessScopeType.DIGITAL_ASSET, 72L);
        ProductAccessRule ignored = rule(packageProduct, ProductAccessScopeType.FORMAT, 40L);

        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription));
        when(productAccessRuleRepository.findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(10L, List.of(9L)))
                .thenReturn(List.of(first, duplicate, second, ignored));

        assertThat(entitlementService.listEntitledDigitalAssetIds(10L, 20L)).containsExactly(71L, 72L);
    }

    private static SubscriptionProduct product(Long id, String slug, int sortOrder) {
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(id);
        product.setSlug(slug);
        product.setTitle(slug);
        product.setSortOrder(sortOrder);
        product.setOfferingType(OfferingType.LEVEL);
        product.setActive(true);
        return product;
    }

    private static Subscription activeSubscription(SubscriptionProduct product) {
        Subscription subscription = new Subscription();
        subscription.setProduct(product);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setEndsAt(null);
        return subscription;
    }

    private static ProductAccessRule rule(
            SubscriptionProduct product,
            ProductAccessScopeType scopeType,
            Long scopeId
    ) {
        ProductAccessRule rule = new ProductAccessRule();
        rule.setProduct(product);
        rule.setScopeType(scopeType);
        rule.setScopeId(scopeId);
        return rule;
    }

    // --- batch evaluation ------------------------------------------------------------------

    @Test
    void filterAccessibleEpisodesGrantsFreeWithoutAnyQuery() {
        EntitlementService.EpisodeAccessSubject free =
                new EntitlementService.EpisodeAccessSubject(true, 0, 30L, Set.of(), Set.of(), null);

        Set<Long> accessible = entitlementService.filterAccessibleEpisodes(
                10L, 20L, java.util.Map.of(1L, free));

        assertThat(accessible).containsExactly(1L);
        org.mockito.Mockito.verifyNoInteractions(subscriptionRepository);
    }

    @Test
    void filterAccessibleEpisodesEvaluatesManyPaidEpisodesAgainstOneSubscriptionFetch() {
        SubscriptionProduct supporter = product(1L, "supporter", 1);
        Subscription active = subscription(supporter, null);
        Subscription expired = subscription(product(2L, "expired", 5), java.time.Instant.now().minusSeconds(60));

        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(active, expired));

        EntitlementService.EpisodeAccessSubject lowLevel = new EntitlementService.EpisodeAccessSubject(
                false, 4, 30L, Set.of(), Set.of(), null);
        EntitlementService.EpisodeAccessSubject withinLevel = new EntitlementService.EpisodeAccessSubject(
                false, 1, 31L, Set.of(40L), Set.of(), 1);
        EntitlementService.EpisodeAccessSubject blockedByMaxFormat = new EntitlementService.EpisodeAccessSubject(
                false, 0, 32L, Set.of(41L), Set.of(), 9);

        Set<Long> accessible = entitlementService.filterAccessibleEpisodes(
                10L, 20L,
                java.util.Map.of(
                        101L, lowLevel,
                        102L, withinLevel,
                        103L, blockedByMaxFormat));

        assertThat(accessible).containsExactlyInAnyOrder(102L);
        // ONE subscription fetch for the whole batch — the N+1 this method replaced
        org.mockito.Mockito.verify(subscriptionRepository, org.mockito.Mockito.times(1))
                .findActiveWithProducts(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                        org.mockito.ArgumentMatchers.any());
    }

    @Test
    void filterAccessibleDigitalAssetsReturnsOnlyGrantedCandidateIds() {
        SubscriptionProduct bundle = product(7L, "bundle", 1);
        bundle.setOfferingType(OfferingType.PACKAGE);
        Subscription active = subscription(bundle, null);
        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(active));
        when(productAccessRuleRepository.findByTenantIdAndProductIdInOrderByProductIdAscIdAsc(
                org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of(digitalRule(501L), digitalRule(502L)));

        Set<Long> accessible = entitlementService.filterAccessibleDigitalAssetIds(
                10L, 20L, List.of(501L, 999L));

        assertThat(accessible).containsExactly(501L);
    }

    @Test
    void filterAccessibleDigitalAssetsIsEmptyWithoutActivePackages() {
        SubscriptionProduct level = product(1L, "fan", 1);
        when(subscriptionRepository.findActiveWithProducts(10L, 20L, SubscriptionStatus.ACTIVE))
                .thenReturn(List.of(subscription(level, null)));

        assertThat(entitlementService.filterAccessibleDigitalAssetIds(10L, 20L, List.of(501L))).isEmpty();
    }

    private Subscription subscription(SubscriptionProduct product, java.time.Instant endsAt) {
        Subscription subscription = new Subscription();
        subscription.setProduct(product);
        subscription.setStatus(SubscriptionStatus.ACTIVE);
        subscription.setEndsAt(endsAt);
        return subscription;
    }

    private ProductAccessRule digitalRule(Long scopeId) {
        ProductAccessRule rule = new ProductAccessRule();
        rule.setScopeType(ProductAccessScopeType.DIGITAL_ASSET);
        rule.setScopeId(scopeId);
        return rule;
    }
}
