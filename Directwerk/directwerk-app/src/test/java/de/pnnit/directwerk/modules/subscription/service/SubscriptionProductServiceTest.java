package de.pnnit.directwerk.modules.subscription.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.content.TenantEntitlementsChangedEvent;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.exception.ConflictException;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.DirectwerkCacheEviction;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.OfferingType;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.exception.SubscriptionProductNotFoundException;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionProductRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class SubscriptionProductServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long PRODUCT_ID = 20L;

    @Mock
    private SubscriptionProductRepository subscriptionProductRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private DirectwerkCacheEviction cacheEviction;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    private SubscriptionProductService service;

    @BeforeEach
    void setUp() {
        service = new SubscriptionProductService(
                subscriptionProductRepository,
                tenantRepository,
                cacheEviction,
                eventPublisher
        );
    }

    @Test
    void createProductRejectsDuplicateSlug() {
        when(subscriptionProductRepository.existsByTenantIdAndSlug(TENANT_ID, "premium")).thenReturn(true);

        assertThatThrownBy(() -> service.createProduct(
                TENANT_ID, "premium", "Premium", null, OfferingType.LEVEL, null, null, null, null
        )).isInstanceOf(ConflictException.class);

        verify(subscriptionProductRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void createProductAppliesDefaultsAndPublishesEvent() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        when(tenantRepository.getReferenceById(TENANT_ID)).thenReturn(tenant);
        when(subscriptionProductRepository.save(any(SubscriptionProduct.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SubscriptionProduct created = service.createProduct(
                TENANT_ID, "premium", "Premium", null, null, null, null, null, null
        );

        assertThat(created.getSlug()).isEqualTo("premium");
        assertThat(created.getOfferingType()).isEqualTo(OfferingType.LEVEL);
        assertThat(created.getSortOrder()).isZero();
        assertThat(created.isActive()).isTrue();
        assertThat(created.getCurrency()).isEqualTo("EUR");
        assertThat(created.getBillingInterval()).isEqualTo(BillingInterval.MONTH);
        verify(cacheEviction).evictPublicProductsAfterCommit(TENANT_ID);
        verify(eventPublisher).publishEvent(new TenantEntitlementsChangedEvent(TENANT_ID));
    }

    @Test
    void createProductRejectsBlankTitle() {
        assertThatThrownBy(() -> service.createProduct(
                TENANT_ID, "premium", "  ", null, OfferingType.LEVEL, null, null, null, null
        )).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("title");
    }

    @Test
    void createProductRejectsInvalidCurrency() {
        assertThatThrownBy(() -> service.createProduct(
                TENANT_ID, "premium", "Premium", null, OfferingType.LEVEL, null, null, "EU", null
        )).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Currency");
    }

    @Test
    void createProductRejectsNegativePrice() {
        assertThatThrownBy(() -> service.createProduct(
                TENANT_ID, "premium", "Premium", null, OfferingType.LEVEL, null, -1, null, null
        )).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("price");
    }

    @Test
    void updateProductClearsStripePriceIdWhenPriceChanges() {
        SubscriptionProduct existing = existingProduct();
        existing.setPriceCents(500);
        existing.setStripePriceId("price_123");
        when(subscriptionProductRepository.findByIdAndTenantId(PRODUCT_ID, TENANT_ID))
                .thenReturn(Optional.of(existing));
        when(subscriptionProductRepository.save(any(SubscriptionProduct.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SubscriptionProduct updated = service.updateProduct(
                TENANT_ID, PRODUCT_ID, null, null, null, null, 900, null, null
        );

        assertThat(updated.getPriceCents()).isEqualTo(900);
        assertThat(updated.getStripePriceId()).isNull();
        verify(eventPublisher).publishEvent(new TenantEntitlementsChangedEvent(TENANT_ID));
    }

    @Test
    void updateProductLeavesStripePriceIdWhenPriceUnchanged() {
        SubscriptionProduct existing = existingProduct();
        existing.setPriceCents(500);
        existing.setCurrency("EUR");
        existing.setBillingInterval(BillingInterval.MONTH);
        existing.setStripePriceId("price_123");
        when(subscriptionProductRepository.findByIdAndTenantId(PRODUCT_ID, TENANT_ID))
                .thenReturn(Optional.of(existing));
        when(subscriptionProductRepository.save(any(SubscriptionProduct.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SubscriptionProduct updated = service.updateProduct(
                TENANT_ID, PRODUCT_ID, "New title", null, null, null, 500, "EUR", BillingInterval.MONTH
        );

        assertThat(updated.getTitle()).isEqualTo("New title");
        assertThat(updated.getStripePriceId()).isEqualTo("price_123");
    }

    @Test
    void requireProductThrowsWhenMissing() {
        when(subscriptionProductRepository.findByIdAndTenantId(PRODUCT_ID, TENANT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requireProduct(TENANT_ID, PRODUCT_ID))
                .isInstanceOf(SubscriptionProductNotFoundException.class);
    }

    @Test
    void deactivateProductSetsActiveFalse() {
        SubscriptionProduct existing = existingProduct();
        existing.setActive(true);
        when(subscriptionProductRepository.findByIdAndTenantId(PRODUCT_ID, TENANT_ID))
                .thenReturn(Optional.of(existing));
        when(subscriptionProductRepository.save(any(SubscriptionProduct.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        SubscriptionProduct deactivated = service.deactivateProduct(TENANT_ID, PRODUCT_ID);

        assertThat(deactivated.isActive()).isFalse();
    }

    private static SubscriptionProduct existingProduct() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(PRODUCT_ID);
        product.setTenant(tenant);
        product.setSlug("premium");
        product.setTitle("Premium");
        product.setOfferingType(OfferingType.LEVEL);
        return product;
    }
}
