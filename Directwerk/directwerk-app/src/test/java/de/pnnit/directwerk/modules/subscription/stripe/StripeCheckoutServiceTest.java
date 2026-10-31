package de.pnnit.directwerk.modules.subscription.stripe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.stripebilling.BillingRedirectUrlValidator;
import de.pnnit.directwerk.modules.stripebilling.StripeCatalogSyncService;
import de.pnnit.directwerk.modules.stripebilling.StripeCheckoutService;
import de.pnnit.directwerk.modules.stripebilling.StripeConnectService;
import de.pnnit.directwerk.modules.stripebilling.StripeOperations;
import de.pnnit.directwerk.modules.stripebilling.entity.StripeCustomer;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.stripebilling.repository.StripeCustomerRepository;
import de.pnnit.directwerk.modules.subscription.entity.Subscription;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionStatus;
import de.pnnit.directwerk.modules.subscription.repository.SubscriptionRepository;
import de.pnnit.directwerk.modules.subscription.entity.BillingInterval;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

@ExtendWith(MockitoExtension.class)
class StripeCheckoutServiceTest {

    private static final Long TENANT_ID = 10L;
    private static final Long USER_ID = 99L;

    @Mock
    private StripeOperations stripeOperations;

    @Mock
    private StripeConnectService stripeConnectService;

    @Mock
    private StripeCatalogSyncService stripeCatalogSyncService;

    @Mock
    private SubscriptionProductService subscriptionProductService;

    @Mock
    private StripeCustomerRepository stripeCustomerRepository;

    @Mock
    private SubscriptionRepository subscriptionRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BillingRedirectUrlValidator redirectUrlValidator;

    @Mock
    private PlatformTransactionManager transactionManager;

    private StripeCheckoutService service;

    @BeforeEach
    void setUp() {
        lenient().when(transactionManager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        service = new StripeCheckoutService(
                stripeOperations,
                stripeConnectService,
                stripeCatalogSyncService,
                subscriptionProductService,
                subscriptionRepository,
                stripeCustomerRepository,
                tenantRepository,
                userRepository,
                redirectUrlValidator,
                transactionManager
        );
    }

    @Test
    void createCheckoutSessionRequiresStripeConfiguration() {
        when(stripeOperations.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.createCheckoutSession(
                TENANT_ID,
                USER_ID,
                "premium",
                null,
                null
        )).isInstanceOf(StripeNotConfiguredException.class);
    }

    @Test
    void createCheckoutSessionRejectsInactiveOrUnpricedProducts() {
        when(stripeOperations.isConfigured()).thenReturn(true);
        SubscriptionProduct inactive = pricedProduct(false, 500, "price_123");
        when(subscriptionProductService.requireProductBySlug(TENANT_ID, "premium")).thenReturn(inactive);

        assertThatThrownBy(() -> service.createCheckoutSession(TENANT_ID, USER_ID, "premium", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not active");

        SubscriptionProduct free = pricedProduct(true, 0, "price_123");
        when(subscriptionProductService.requireProductBySlug(TENANT_ID, "free")).thenReturn(free);

        assertThatThrownBy(() -> service.createCheckoutSession(TENANT_ID, USER_ID, "free", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not priced");
    }

    @Test
    void createCheckoutSessionRejectsASecondSubscriptionForTheSameProduct() {
        // #534: the single (tenant, user, product) row cannot represent two Stripe
        // subscriptions, so a second checkout must not start.
        when(stripeOperations.isConfigured()).thenReturn(true);
        SubscriptionProduct product = pricedProduct(true, 500, "price_123");
        when(subscriptionProductService.requireProductBySlug(TENANT_ID, "premium")).thenReturn(product);

        Subscription active = new Subscription();
        active.setStatus(SubscriptionStatus.ACTIVE);
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductIdForUpdate(
                TENANT_ID, USER_ID, product.getId())).thenReturn(java.util.Optional.of(active));

        assertThatThrownBy(() -> service.createCheckoutSession(TENANT_ID, USER_ID, "premium", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");

        verify(stripeOperations, never()).createCheckoutSession(any());
    }

    @Test
    void createCheckoutSessionRejectsAnOpenNonActiveStripeSubscription() {
        // #705 review: a PAST_DUE / INCOMPLETE row keeps its Stripe id, so the inbound webhook
        // refuses the rebind — checkout must refuse first instead of charging into a void.
        when(stripeOperations.isConfigured()).thenReturn(true);
        SubscriptionProduct product = pricedProduct(true, 500, "price_123");
        when(subscriptionProductService.requireProductBySlug(TENANT_ID, "premium")).thenReturn(product);

        Subscription pastDue = new Subscription();
        pastDue.setStatus(SubscriptionStatus.PAST_DUE);
        pastDue.setSource(de.pnnit.directwerk.modules.subscription.entity.SubscriptionSource.STRIPE);
        pastDue.setExternalSubscriptionId("sub_old");
        when(subscriptionRepository.findByTenantIdAndUserIdAndProductIdForUpdate(
                TENANT_ID, USER_ID, product.getId())).thenReturn(java.util.Optional.of(pastDue));

        assertThatThrownBy(() -> service.createCheckoutSession(TENANT_ID, USER_ID, "premium", null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("open Stripe subscription");

        verify(stripeOperations, never()).createCheckoutSession(any());
    }

    @Test
    void createCheckoutSessionUsesExistingCustomerAndReturnsSessionUrl() {
        SubscriptionProduct product = pricedProduct(true, 500, "price_123");
        TenantStripeAccount account = stripeAccount();
        StripeCustomer existingCustomer = new StripeCustomer();
        existingCustomer.setStripeCustomerId("cus_existing");

        when(stripeOperations.isConfigured()).thenReturn(true);
        when(subscriptionProductService.requireProductBySlug(TENANT_ID, "premium")).thenReturn(product);
        when(stripeConnectService.requireChargeableAccount(TENANT_ID)).thenReturn(account);
        when(stripeCustomerRepository.findByTenantIdAndUserId(TENANT_ID, USER_ID))
                .thenReturn(Optional.of(existingCustomer));
        when(redirectUrlValidator.defaultPublicUrl(TENANT_ID, "/checkout/success?session_id={CHECKOUT_SESSION_ID}"))
                .thenReturn("https://podcast.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}");
        when(redirectUrlValidator.defaultPublicUrl(TENANT_ID, "/checkout/cancel"))
                .thenReturn("https://podcast.example.com/checkout/cancel");
        when(redirectUrlValidator.requireAllowedUrl(
                eq(TENANT_ID),
                eq("https://podcast.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}"),
                eq("redirectUrl")
        )).thenReturn("https://podcast.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}");
        when(redirectUrlValidator.requireAllowedUrl(
                eq(TENANT_ID),
                eq("https://podcast.example.com/checkout/cancel"),
                eq("redirectUrl")
        )).thenReturn("https://podcast.example.com/checkout/cancel");
        when(stripeOperations.createCheckoutSession(any())).thenReturn(
                new StripeOperations.CheckoutSessionResult("cs_123", "https://checkout.stripe.test/cs_123")
        );

        String url = service.createCheckoutSession(TENANT_ID, USER_ID, "premium", null, null);

        assertThat(url).isEqualTo("https://checkout.stripe.test/cs_123");
        verify(stripeOperations).createCheckoutSession(new StripeOperations.CheckoutSessionCommand(
                "acct_123",
                "cus_existing",
                "price_123",
                BillingInterval.MONTH,
                "https://podcast.example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
                "https://podcast.example.com/checkout/cancel",
                Map.of(
                        "tenant_id", TENANT_ID.toString(),
                        "user_id", USER_ID.toString(),
                        "product_id", product.getId().toString(),
                        "product_slug", "premium"
                )
        ));
    }

    @Test
    void createCheckoutSessionSyncsCatalogAndCreatesCustomerWhenMissing() {
        SubscriptionProduct product = pricedProduct(true, 500, null);
        product.setId(20L);
        SubscriptionProduct synced = pricedProduct(true, 500, "price_synced");
        synced.setId(20L);
        TenantStripeAccount account = stripeAccount();
        User user = new User();
        user.setId(USER_ID);
        user.setEmail("subscriber@example.com");
        Tenant tenant = new Tenant();
        tenant.setId(TENANT_ID);

        when(stripeOperations.isConfigured()).thenReturn(true);
        when(subscriptionProductService.requireProductBySlug(TENANT_ID, "premium")).thenReturn(product);
        when(stripeConnectService.requireChargeableAccount(TENANT_ID)).thenReturn(account);
        when(stripeCatalogSyncService.syncProduct(TENANT_ID, 20L)).thenReturn(synced);
        when(stripeCustomerRepository.findByTenantIdAndUserId(TENANT_ID, USER_ID)).thenReturn(Optional.empty());
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(stripeOperations.createCustomer(eq("acct_123"), eq("subscriber@example.com"), any()))
                .thenReturn("cus_new");
        when(tenantRepository.getReferenceById(TENANT_ID)).thenReturn(tenant);
        when(redirectUrlValidator.requireAllowedUrl(
                TENANT_ID,
                "https://podcast.example.com/success",
                "redirectUrl"
        )).thenReturn("https://podcast.example.com/success");
        when(redirectUrlValidator.requireAllowedUrl(
                TENANT_ID,
                "https://podcast.example.com/cancel",
                "redirectUrl"
        )).thenReturn("https://podcast.example.com/cancel");
        when(stripeOperations.createCheckoutSession(any())).thenReturn(
                new StripeOperations.CheckoutSessionResult("cs_456", "https://checkout.stripe.test/cs_456")
        );

        String url = service.createCheckoutSession(
                TENANT_ID,
                USER_ID,
                "premium",
                "https://podcast.example.com/success",
                "https://podcast.example.com/cancel"
        );

        assertThat(url).isEqualTo("https://checkout.stripe.test/cs_456");
        verify(stripeCatalogSyncService).syncProduct(TENANT_ID, 20L);
        verify(stripeCustomerRepository).save(any(StripeCustomer.class));
        verify(redirectUrlValidator).requireAllowedUrl(
                TENANT_ID,
                "https://podcast.example.com/success",
                "redirectUrl"
        );
    }

    private static SubscriptionProduct pricedProduct(boolean active, int priceCents, String stripePriceId) {
        SubscriptionProduct product = new SubscriptionProduct();
        product.setId(20L);
        product.setSlug("premium");
        product.setActive(active);
        product.setPriceCents(priceCents);
        product.setStripePriceId(stripePriceId);
        product.setBillingInterval(BillingInterval.MONTH);
        return product;
    }

    private static TenantStripeAccount stripeAccount() {
        TenantStripeAccount account = new TenantStripeAccount();
        account.setStripeAccountId("acct_123");
        return account;
    }
}
