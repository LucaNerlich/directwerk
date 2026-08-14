package de.pnnit.directwerk.modules.subscription.stripe;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.subscription.StripeBillingModule;
import de.pnnit.directwerk.modules.subscription.entity.SubscriptionProduct;
import de.pnnit.directwerk.modules.subscription.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.subscription.service.SubscriptionProductService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StripeCatalogSyncService {

    private final StripeOperations stripeOperations;
    private final StripeConnectService stripeConnectService;
    private final SubscriptionProductService subscriptionProductService;

    public StripeCatalogSyncService(
            StripeOperations stripeOperations,
            StripeConnectService stripeConnectService,
            SubscriptionProductService subscriptionProductService
    ) {
        this.stripeOperations = stripeOperations;
        this.stripeConnectService = stripeConnectService;
        this.subscriptionProductService = subscriptionProductService;
    }

    @Transactional
    @RequiresModule(StripeBillingModule.KEY)
    public SubscriptionProduct syncProduct(Long tenantId, Long productId) {
        SubscriptionProduct product = subscriptionProductService.requireProduct(tenantId, productId);
        if (product.getPriceCents() == null || product.getPriceCents() <= 0) {
            throw new IllegalArgumentException("Product price must be greater than 0 before Stripe sync");
        }
        if (product.getCurrency() == null || product.getCurrency().isBlank()) {
            throw new IllegalArgumentException("Product currency is required");
        }
        TenantStripeAccount account = stripeConnectService.requireChargeableAccount(tenantId);
        StripeOperations.CatalogIds ids = stripeOperations.upsertProductAndPrice(
                account.getStripeAccountId(),
                product.getStripeProductId(),
                product.getTitle(),
                product.getDescription(),
                product.getPriceCents(),
                product.getCurrency(),
                product.getBillingInterval()
        );
        return subscriptionProductService.assignStripeIds(tenantId, productId, ids.productId(), ids.priceId());
    }
}
