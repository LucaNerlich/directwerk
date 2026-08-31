package de.pnnit.directwerk.modules.stripebilling;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.stripebilling.entity.StripeCustomer;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeConnectNotReadyException;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.stripebilling.repository.StripeCustomerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StripeCustomerPortalService {

    private final StripeOperations stripeOperations;
    private final StripeConnectService stripeConnectService;
    private final StripeCustomerRepository stripeCustomerRepository;
    private final BillingRedirectUrlValidator redirectUrlValidator;

    public StripeCustomerPortalService(
            StripeOperations stripeOperations,
            StripeConnectService stripeConnectService,
            StripeCustomerRepository stripeCustomerRepository,
            BillingRedirectUrlValidator redirectUrlValidator
    ) {
        this.stripeOperations = stripeOperations;
        this.stripeConnectService = stripeConnectService;
        this.stripeCustomerRepository = stripeCustomerRepository;
        this.redirectUrlValidator = redirectUrlValidator;
    }

    @Transactional
    @RequiresModule(StripeBillingModule.KEY)
    public String createPortalSession(Long tenantId, Long userId, String returnUrl) {
        if (!stripeOperations.isConfigured()) {
            throw new StripeNotConfiguredException("Stripe customer portal is not configured");
        }
        TenantStripeAccount account = stripeConnectService.requireChargeableAccount(tenantId);
        StripeCustomer customer = stripeCustomerRepository.findByTenantIdAndUserId(tenantId, userId)
                .orElseThrow(() -> new StripeConnectNotReadyException("No Stripe customer exists for this member"));
        String safeReturn = returnUrl != null && !returnUrl.isBlank()
                ? redirectUrlValidator.requireAllowedUrl(tenantId, returnUrl, "returnUrl")
                : redirectUrlValidator.requireAllowedUrl(
                        tenantId,
                        redirectUrlValidator.defaultPublicUrl(tenantId, "/account"),
                        "returnUrl"
                );
        return stripeOperations.createPortalSession(
                account.getStripeAccountId(),
                customer.getStripeCustomerId(),
                safeReturn
        );
    }
}
