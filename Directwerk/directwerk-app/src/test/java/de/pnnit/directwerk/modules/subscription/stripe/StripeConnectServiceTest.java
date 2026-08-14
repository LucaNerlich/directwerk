package de.pnnit.directwerk.modules.subscription.stripe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.repository.TenantRepository;
import de.pnnit.directwerk.modules.core.service.ModuleGateService;
import de.pnnit.directwerk.modules.subscription.StripeBillingModule;
import de.pnnit.directwerk.modules.subscription.entity.TenantStripeAccount;
import de.pnnit.directwerk.modules.subscription.exception.StripeNotConfiguredException;
import de.pnnit.directwerk.modules.subscription.repository.TenantStripeAccountRepository;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StripeConnectServiceTest {

    @Mock
    private StripeOperations stripeOperations;

    @Mock
    private TenantStripeAccountRepository tenantStripeAccountRepository;

    @Mock
    private TenantRepository tenantRepository;

    @Mock
    private ModuleGateService moduleGateService;

    @Mock
    private BillingRedirectUrlValidator redirectUrlValidator;

    private StripeConnectService service;

    @BeforeEach
    void setUp() {
        service = new StripeConnectService(
                stripeOperations,
                tenantStripeAccountRepository,
                tenantRepository,
                moduleGateService,
                redirectUrlValidator
        );
    }

    @Test
    void statusIsNotConnectedWhenPlatformKeysMissing() {
        when(moduleGateService.enabledModuleKeys(7L)).thenReturn(Set.of(StripeBillingModule.KEY));
        when(stripeOperations.isConfigured()).thenReturn(false);

        StripeConnectService.StripeStatusSnapshot snapshot = service.status(7L);

        assertThat(snapshot.status()).isEqualTo("NOT_CONNECTED");
        assertThat(snapshot.moduleEnabled()).isTrue();
        assertThat(snapshot.chargesEnabled()).isFalse();
    }

    @Test
    void onboardCreatesExpressAccountAndReturnsLink() {
        when(stripeOperations.isConfigured()).thenReturn(true);
        when(redirectUrlValidator.requireAllowedUrl(eq(7L), eq("https://studio.localhost/settings/stripe"), eq("returnUrl")))
                .thenReturn("https://studio.localhost/settings/stripe");
        when(redirectUrlValidator.requireAllowedUrl(eq(7L), eq("https://studio.localhost/settings/stripe"), eq("refreshUrl")))
                .thenReturn("https://studio.localhost/settings/stripe");
        when(tenantStripeAccountRepository.findByTenantId(7L)).thenReturn(Optional.empty());
        when(stripeOperations.createExpressAccount(eq("DE"), anyMap()))
                .thenReturn(new StripeOperations.ConnectedAccount("acct_123", false, false, false));
        Tenant tenant = new Tenant();
        tenant.setId(7L);
        when(tenantRepository.getReferenceById(7L)).thenReturn(tenant);
        when(tenantStripeAccountRepository.save(any(TenantStripeAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(stripeOperations.createAccountLink("acct_123", "https://studio.localhost/settings/stripe", "https://studio.localhost/settings/stripe"))
                .thenReturn("https://connect.stripe.com/setup/s/abc");

        String url = service.createOnboardLink(
                7L,
                "https://studio.localhost/settings/stripe",
                "https://studio.localhost/settings/stripe"
        );

        assertThat(url).isEqualTo("https://connect.stripe.com/setup/s/abc");
        ArgumentCaptor<TenantStripeAccount> captor = ArgumentCaptor.forClass(TenantStripeAccount.class);
        verify(tenantStripeAccountRepository).save(captor.capture());
        assertThat(captor.getValue().getStripeAccountId()).isEqualTo("acct_123");
        assertThat(captor.getValue().getStatus()).isEqualTo("PENDING");
    }

    @Test
    void onboardFailsClosedWhenNotConfigured() {
        when(stripeOperations.isConfigured()).thenReturn(false);

        assertThatThrownBy(() -> service.createOnboardLink(7L, "https://studio.localhost/x", "https://studio.localhost/x"))
                .isInstanceOf(StripeNotConfiguredException.class);
    }
}
