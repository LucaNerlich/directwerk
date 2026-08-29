package de.pnnit.directwerk.modules.stripebilling;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.entity.User;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.repository.UserRepository;
import de.pnnit.directwerk.modules.stripebilling.StripeBillingModule;
import de.pnnit.directwerk.modules.stripebilling.entity.StripeCustomer;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.stripebilling.repository.StripeCustomerRepository;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class StripeCheckoutService {

    private final StripeOperations stripeOperations;
    private final StripeConnectService stripeConnectService;
    private final StripeCatalogSyncService stripeCatalogSyncService;
    private final SubscriptionProductService subscriptionProductService;
    private final StripeCustomerRepository stripeCustomerRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final BillingRedirectUrlValidator redirectUrlValidator;

    public StripeCheckoutService(
            StripeOperations stripeOperations,
            StripeConnectService stripeConnectService,
            StripeCatalogSyncService stripeCatalogSyncService,
            SubscriptionProductService subscriptionProductService,
            StripeCustomerRepository stripeCustomerRepository,
            TenantRepository tenantRepository,
            UserRepository userRepository,
            BillingRedirectUrlValidator redirectUrlValidator
    ) {
        this.stripeOperations = stripeOperations;
        this.stripeConnectService = stripeConnectService;
        this.stripeCatalogSyncService = stripeCatalogSyncService;
        this.subscriptionProductService = subscriptionProductService;
        this.stripeCustomerRepository = stripeCustomerRepository;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.redirectUrlValidator = redirectUrlValidator;
    }

    // Deliberately not @Transactional: this method spans up to three remote Stripe HTTP
    // calls (account refresh, customer creation, session creation). Holding a pooled DB
    // connection across them exhausts Hikari under concurrent checkout load. Each
    // collaborator (requireChargeableAccount, syncProduct, repository saves) opens its
    // own short transaction instead.
    @RequiresModule(StripeBillingModule.KEY)
    public String createCheckoutSession(
            Long tenantId,
            Long userId,
            String productSlug,
            String successUrl,
            String cancelUrl
    ) {
        if (!stripeOperations.isConfigured()) {
            throw new StripeNotConfiguredException(
                    "Stripe checkout is not implemented yet for product=" + productSlug
            );
        }
        SubscriptionProduct product = subscriptionProductService.requireProductBySlug(tenantId, productSlug);
        if (!product.isActive()) {
            throw new IllegalArgumentException("Subscription product is not active");
        }
        if (product.getPriceCents() == null || product.getPriceCents() <= 0) {
            throw new IllegalArgumentException("Product is not priced for checkout");
        }
        TenantStripeAccount account = stripeConnectService.requireChargeableAccount(tenantId);
        if (product.getStripePriceId() == null || product.getStripePriceId().isBlank()) {
            product = stripeCatalogSyncService.syncProduct(tenantId, product.getId());
        }
        String safeSuccess = resolveRedirect(tenantId, successUrl, "/checkout/success?session_id={CHECKOUT_SESSION_ID}");
        String safeCancel = resolveRedirect(tenantId, cancelUrl, "/checkout/cancel");
        String customerId = ensureCustomer(tenantId, userId, account.getStripeAccountId());
        StripeOperations.CheckoutSessionResult session = stripeOperations.createCheckoutSession(
                new StripeOperations.CheckoutSessionCommand(
                        account.getStripeAccountId(),
                        customerId,
                        product.getStripePriceId(),
                        product.getBillingInterval(),
                        safeSuccess,
                        safeCancel,
                        Map.of(
                                "tenant_id", tenantId.toString(),
                                "user_id", userId.toString(),
                                "product_id", product.getId().toString(),
                                "product_slug", product.getSlug()
                        )
                )
        );
        return session.url();
    }

    private String resolveRedirect(Long tenantId, String requested, String defaultPath) {
        if (requested != null && !requested.isBlank()) {
            return redirectUrlValidator.requireAllowedUrl(tenantId, requested, "redirectUrl");
        }
        return redirectUrlValidator.requireAllowedUrl(
                tenantId,
                redirectUrlValidator.defaultPublicUrl(tenantId, defaultPath),
                "redirectUrl"
        );
    }

    private String ensureCustomer(Long tenantId, Long userId, String accountId) {
        return stripeCustomerRepository.findByTenantIdAndUserId(tenantId, userId)
                .map(StripeCustomer::getStripeCustomerId)
                .orElseGet(() -> createCustomerRow(tenantId, userId, accountId));
    }

    private String createCustomerRow(Long tenantId, Long userId, String accountId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        String customerId = stripeOperations.createCustomer(
                accountId,
                user.getEmail(),
                Map.of(
                        "tenant_id", tenantId.toString(),
                        "user_id", userId.toString()
                )
        );
        StripeCustomer created = new StripeCustomer();
        created.setTenant(tenantRepository.getReferenceById(tenantId));
        created.setUser(user);
        created.setStripeCustomerId(customerId);
        try {
            stripeCustomerRepository.save(created);
            return customerId;
        } catch (DataIntegrityViolationException ex) {
            // Concurrent first checkout for the same user: the unique (tenant_id, user_id)
            // row was inserted by another request after our initial find.
            return stripeCustomerRepository.findByTenantIdAndUserId(tenantId, userId)
                    .map(StripeCustomer::getStripeCustomerId)
                    .orElseThrow(() -> ex);
        }
    }
}
