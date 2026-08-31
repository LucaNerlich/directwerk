package de.pnnit.directwerk.modules.stripebilling;

import de.pnnit.directwerk.modules.core.RequiresModule;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.stripebilling.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeConnectNotReadyException;
import de.pnnit.directwerk.modules.stripebilling.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.stripebilling.repository.TenantStripeAccountRepository;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class StripeConnectService {

    private final StripeOperations stripeOperations;
    private final TenantStripeAccountRepository tenantStripeAccountRepository;
    private final TenantRepository tenantRepository;
    private final ModuleGateService moduleGateService;
    private final BillingRedirectUrlValidator redirectUrlValidator;

    public StripeConnectService(
            StripeOperations stripeOperations,
            TenantStripeAccountRepository tenantStripeAccountRepository,
            TenantRepository tenantRepository,
            ModuleGateService moduleGateService,
            BillingRedirectUrlValidator redirectUrlValidator
    ) {
        this.stripeOperations = stripeOperations;
        this.tenantStripeAccountRepository = tenantStripeAccountRepository;
        this.tenantRepository = tenantRepository;
        this.moduleGateService = moduleGateService;
        this.redirectUrlValidator = redirectUrlValidator;
    }

    @Transactional(readOnly = true)
    public StripeStatusSnapshot status(Long tenantId) {
        boolean moduleEnabled = moduleGateService.enabledModuleKeys(tenantId).contains(StripeBillingModule.KEY);
        TenantStripeAccount stored = tenantStripeAccountRepository.findByTenantId(tenantId).orElse(null);
        if (!stripeOperations.isConfigured()) {
            return new StripeStatusSnapshot(
                    "NOT_CONNECTED",
                    moduleEnabled,
                    "Stripe-Schlüssel sind auf der Plattform nicht konfiguriert.",
                    false,
                    false,
                    false
            );
        }
        if (stored == null) {
            return new StripeStatusSnapshot(
                    "NOT_CONNECTED",
                    moduleEnabled,
                    "Stripe Connect ist noch nicht eingerichtet.",
                    false,
                    false,
                    false
            );
        }
        return toSnapshot(stored, moduleEnabled);
    }

    @Transactional
    @RequiresModule(StripeBillingModule.KEY)
    public String createOnboardLink(Long tenantId, String returnUrl, String refreshUrl) {
        if (!stripeOperations.isConfigured()) {
            throw new StripeNotConfiguredException("Stripe Connect onboarding is not implemented yet.");
        }
        String safeReturn = redirectUrlValidator.requireAllowedUrl(tenantId, returnUrl, "returnUrl");
        String safeRefresh = redirectUrlValidator.requireAllowedUrl(tenantId, refreshUrl, "refreshUrl");
        TenantStripeAccount account = tenantStripeAccountRepository.findByTenantId(tenantId).orElse(null);
        if (account == null) {
            StripeOperations.ConnectedAccount created = stripeOperations.createExpressAccount(
                    "DE",
                    Map.of("tenant_id", tenantId.toString())
            );
            account = new TenantStripeAccount();
            account.setTenant(tenantRepository.getReferenceById(tenantId));
            account.setStripeAccountId(created.accountId());
            applyCapabilities(account, created);
            account = tenantStripeAccountRepository.save(account);
        }
        return stripeOperations.createAccountLink(account.getStripeAccountId(), safeRefresh, safeReturn);
    }

    @Transactional
    public TenantStripeAccount requireChargeableAccount(Long tenantId) {
        TenantStripeAccount account = tenantStripeAccountRepository.findByTenantId(tenantId)
                .orElseThrow(() -> new StripeConnectNotReadyException("Stripe Connect is not connected"));
        refreshFromStripe(account);
        if (!account.isChargesEnabled()) {
            throw new StripeConnectNotReadyException("Stripe Connect cannot take charges yet");
        }
        return account;
    }

    @Transactional
    public void refreshFromStripe(TenantStripeAccount account) {
        if (!stripeOperations.isConfigured()) {
            return;
        }
        StripeOperations.ConnectedAccount live = stripeOperations.retrieveAccount(account.getStripeAccountId());
        applyCapabilities(account, live);
        tenantStripeAccountRepository.save(account);
    }

    @Transactional
    public void applyAccountUpdate(
            String stripeAccountId,
            boolean chargesEnabled,
            boolean payoutsEnabled,
            boolean detailsSubmitted
    ) {
        tenantStripeAccountRepository.findByStripeAccountId(stripeAccountId).ifPresent(account -> {
            account.setChargesEnabled(chargesEnabled);
            account.setPayoutsEnabled(payoutsEnabled);
            account.setDetailsSubmitted(detailsSubmitted);
            account.setStatus(deriveStatus(chargesEnabled, detailsSubmitted));
            tenantStripeAccountRepository.save(account);
        });
    }

    public TenantStripeAccount findByStripeAccountId(String stripeAccountId) {
        return tenantStripeAccountRepository.findByStripeAccountId(stripeAccountId).orElse(null);
    }

    public TenantStripeAccount findByTenantId(Long tenantId) {
        return tenantStripeAccountRepository.findByTenantId(tenantId).orElse(null);
    }

    private static void applyCapabilities(TenantStripeAccount account, StripeOperations.ConnectedAccount live) {
        account.setChargesEnabled(live.chargesEnabled());
        account.setPayoutsEnabled(live.payoutsEnabled());
        account.setDetailsSubmitted(live.detailsSubmitted());
        account.setStatus(deriveStatus(live.chargesEnabled(), live.detailsSubmitted()));
    }

    private static String deriveStatus(boolean chargesEnabled, boolean detailsSubmitted) {
        if (chargesEnabled) {
            return "CONNECTED";
        }
        if (detailsSubmitted) {
            return "RESTRICTED";
        }
        return "PENDING";
    }

    private static StripeStatusSnapshot toSnapshot(TenantStripeAccount account, boolean moduleEnabled) {
        String message = switch (account.getStatus()) {
            case "CONNECTED" -> "Stripe ist verbunden und kann Zahlungen annehmen.";
            case "RESTRICTED" -> "Angaben sind eingereicht, Zahlungen sind noch eingeschränkt.";
            default -> "Onboarding ist gestartet. Schließe die Angaben bei Stripe ab.";
        };
        return new StripeStatusSnapshot(
                account.getStatus(),
                moduleEnabled,
                message,
                account.isChargesEnabled(),
                account.isPayoutsEnabled(),
                account.isDetailsSubmitted()
        );
    }

    public record StripeStatusSnapshot(
            String status,
            boolean moduleEnabled,
            String message,
            boolean chargesEnabled,
            boolean payoutsEnabled,
            boolean detailsSubmitted
    ) {
    }
}
