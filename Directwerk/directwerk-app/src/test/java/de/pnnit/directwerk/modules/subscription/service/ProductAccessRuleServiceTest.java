package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessRule;
import de.pnnit.directwerk.modules.subscription.entity.ProductAccessScopeType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.repository.ProductAccessRuleRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class ProductAccessRuleServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long PRODUCT_ID = 20L;

    @Mock
    private ProductAccessRuleRepository productAccessRuleRepository;

    @Mock
    private SubscriptionProductService subscriptionProductService;

    @Mock
    private ProductAccessRuleScopeValidator productAccessRuleScopeValidator;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ProductAccessRuleService service;

    @Test
    void listRulesRequiresProductAndReturnsOrderedRules() {
        SubscriptionProduct product = packageProduct();
        ProductAccessRule rule = new ProductAccessRule();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        when(productAccessRuleRepository.findByTenantIdAndProductIdOrderByIdAsc(TENANT_ID, PRODUCT_ID))
                .thenReturn(List.of(rule));

        assertThat(service.listRules(TENANT_ID, PRODUCT_ID)).containsExactly(rule);
    }

    @Test
    void replaceRulesRejectsNonPackageProducts() {
        SubscriptionProduct levelProduct = packageProduct();
        levelProduct.setOfferingType(OfferingType.LEVEL);
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(levelProduct);

        assertThatThrownBy(() -> service.replaceRules(TENANT_ID, PRODUCT_ID, List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PACKAGE");

        verify(productAccessRuleRepository, never()).deleteByTenantIdAndProductId(any(), any());
    }

    @Test
    @SuppressWarnings("unchecked")
    void replaceRulesValidatesScopesReplacesRulesAndPublishesEvent() {
        SubscriptionProduct product = packageProduct();
        ProductAccessRuleService.RuleInput allPodcasts =
                new ProductAccessRuleService.RuleInput(ProductAccessScopeType.ALL_PODCASTS, null);
        ProductAccessRuleService.RuleInput series =
                new ProductAccessRuleService.RuleInput(ProductAccessScopeType.PODCAST_SERIES, 5L);
        ProductAccessRule persisted = new ProductAccessRule();

        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        when(productAccessRuleRepository.findByTenantIdAndProductIdOrderByIdAsc(TENANT_ID, PRODUCT_ID))
                .thenReturn(List.of(persisted));

        List<ProductAccessRule> result = service.replaceRules(
                TENANT_ID,
                PRODUCT_ID,
                List.of(allPodcasts, series)
        );

        verify(productAccessRuleScopeValidator).validateScope(TENANT_ID, ProductAccessScopeType.ALL_PODCASTS, null);
        verify(productAccessRuleScopeValidator).validateScope(TENANT_ID, ProductAccessScopeType.PODCAST_SERIES, 5L);
        verify(productAccessRuleRepository).deleteByTenantIdAndProductId(TENANT_ID, PRODUCT_ID);

        ArgumentCaptor<List<ProductAccessRule>> savedCaptor = ArgumentCaptor.forClass(List.class);
        verify(productAccessRuleRepository).saveAll(savedCaptor.capture());
        assertThat(savedCaptor.getValue()).hasSize(2);
        assertThat(savedCaptor.getValue().get(0).getScopeType()).isEqualTo(ProductAccessScopeType.ALL_PODCASTS);
        assertThat(savedCaptor.getValue().get(0).getScopeId()).isNull();
        assertThat(savedCaptor.getValue().get(1).getScopeType()).isEqualTo(ProductAccessScopeType.PODCAST_SERIES);
        assertThat(savedCaptor.getValue().get(1).getScopeId()).isEqualTo(5L);

        verify(eventPublisher).publishEvent(new TenantEntitlementsChangedEvent(TENANT_ID));
        assertThat(result).containsExactly(persisted);
    }

    @Test
    void replaceRulesRejectsSeriesRuleWithoutScopeId() {
        SubscriptionProduct product = packageProduct();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);

        assertThatThrownBy(() -> service.replaceRules(
                TENANT_ID,
                PRODUCT_ID,
                List.of(new ProductAccessRuleService.RuleInput(ProductAccessScopeType.PODCAST_SERIES, null))
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("scopeId");

        verify(productAccessRuleScopeValidator).validateScope(
                eq(TENANT_ID),
                eq(ProductAccessScopeType.PODCAST_SERIES),
                eq(null)
        );
        verify(productAccessRuleRepository, never()).saveAll(any());
    }

    @Test
    void replaceRulesRejectsAllPodcastsRuleWithScopeId() {
        SubscriptionProduct product = packageProduct();
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);

        assertThatThrownBy(() -> service.replaceRules(
                TENANT_ID,
                PRODUCT_ID,
                List.of(new ProductAccessRuleService.RuleInput(ProductAccessScopeType.ALL_PODCASTS, 1L))
        )).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("must not set scopeId");
    }

    private static SubscriptionProduct packageProduct() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(PRODUCT_ID);
        product.setTenant(tenant);
        product.setOfferingType(OfferingType.PACKAGE);
        product.setSlug("premium");
        return product;
    }
}
