package de.pnnit.directwerk.modules.stripebilling;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StripeCatalogSyncServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long PRODUCT_ID = 20L;

    @Mock
    private StripeOperations stripeOperations;

    @Mock
    private StripeConnectService stripeConnectService;

    @Mock
    private SubscriptionProductService subscriptionProductService;

    private StripeCatalogSyncService service;

    @BeforeEach
    void setUp() {
        service = new StripeCatalogSyncService(stripeOperations, stripeConnectService, subscriptionProductService);
    }

    @Test
    void syncProductRejectsUnpricedProduct() {
        SubscriptionProduct product = product();
        product.setPriceCents(null);
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);

        assertThatThrownBy(() -> service.syncProduct(TENANT_ID, PRODUCT_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("price");
    }

    @Test
    void syncProductRejectsMissingCurrency() {
        SubscriptionProduct product = product();
        product.setCurrency(null);
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);

        assertThatThrownBy(() -> service.syncProduct(TENANT_ID, PRODUCT_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("currency");
    }

    @Test
    void syncProductUpsertsCatalogAndAssignsStripeIds() {
        SubscriptionProduct product = product();
        TenantStripeAccount account = new TenantStripeAccount();
        account.setStripeAccountId("acct_123");
        when(subscriptionProductService.requireProduct(TENANT_ID, PRODUCT_ID)).thenReturn(product);
        when(stripeConnectService.requireChargeableAccount(TENANT_ID)).thenReturn(account);
        when(stripeOperations.upsertProductAndPrice(
                eq("acct_123"), any(), eq("Premium"), any(), eq(500L), eq("EUR"), eq(BillingInterval.MONTH)
        )).thenReturn(new StripeOperations.CatalogIds("prod_1", "price_1"));
        SubscriptionProduct assigned = product();
        assigned.setStripeProductId("prod_1");
        assigned.setStripePriceId("price_1");
        when(subscriptionProductService.assignStripeIds(TENANT_ID, PRODUCT_ID, "prod_1", "price_1"))
                .thenReturn(assigned);

        SubscriptionProduct result = service.syncProduct(TENANT_ID, PRODUCT_ID);

        assertThat(result.getStripeProductId()).isEqualTo("prod_1");
        assertThat(result.getStripePriceId()).isEqualTo("price_1");
        verify(subscriptionProductService).assignStripeIds(TENANT_ID, PRODUCT_ID, "prod_1", "price_1");
    }

    private static SubscriptionProduct product() {
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(PRODUCT_ID);
        product.setTenant(tenant);
        product.setSlug("premium");
        product.setTitle("Premium");
        product.setPriceCents(500);
        product.setCurrency("EUR");
        product.setBillingInterval(BillingInterval.MONTH);
        return product;
    }
}
