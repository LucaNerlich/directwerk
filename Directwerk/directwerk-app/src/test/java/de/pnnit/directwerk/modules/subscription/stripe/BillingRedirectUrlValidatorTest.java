package de.pnnit.directwerk.modules.subscription.stripe;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantDomain;
import de.pnnit.directwerk.modules.core.repository.TenantDomainRepository;
import de.pnnit.directwerk.modules.stripebilling.BillingRedirectUrlValidator;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BillingRedirectUrlValidatorTest {

    private static final Long TENANT_ID = 7L;

    @Mock
    private TenantDomainRepository tenantDomainRepository;

    @Mock
    private DirectwerkConfig directwerkConfig;

    private BillingRedirectUrlValidator validator;

    @BeforeEach
    void setUp() {
        validator = new BillingRedirectUrlValidator(tenantDomainRepository, directwerkConfig);
    }

    @Test
    void acceptsTenantPrimaryDomainOverHttps() {
        stubStudioHost("https://studio.example.com");
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(TENANT_ID, "podcast.example.com"))
                .thenReturn(Optional.of(tenantDomain("podcast.example.com", true)));

        String normalized = validator.requireAllowedUrl(
                TENANT_ID,
                "https://podcast.example.com/billing/success",
                "successUrl"
        );

        assertThat(normalized).isEqualTo("https://podcast.example.com/billing/success");
    }

    @Test
    void acceptsLoopbackHttpForLocalDevelopment() {
        String normalized = validator.requireAllowedUrl(
                TENANT_ID,
                "http://localhost:3000/settings/stripe",
                "returnUrl"
        );

        assertThat(normalized).isEqualTo("http://localhost:3000/settings/stripe");
    }

    @Test
    void acceptsStudioHostWhenConfigured() {
        stubStudioHost("https://studio.example.com");

        String normalized = validator.requireAllowedUrl(
                TENANT_ID,
                "https://studio.example.com/settings/stripe",
                "returnUrl"
        );

        assertThat(normalized).isEqualTo("https://studio.example.com/settings/stripe");
    }

    @Test
    void rejectsBlankUrlsFragmentsAndUserInfo() {
        assertThatThrownBy(() -> validator.requireAllowedUrl(TENANT_ID, " ", "returnUrl"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("required");
        assertThatThrownBy(() -> validator.requireAllowedUrl(
                TENANT_ID,
                "https://podcast.example.com/path#fragment",
                "returnUrl"
        )).hasMessageContaining("fragment");
        assertThatThrownBy(() -> validator.requireAllowedUrl(
                TENANT_ID,
                "https://user:pass@podcast.example.com/path",
                "returnUrl"
        )).hasMessageContaining("user info");
    }

    @Test
    void rejectsDisallowedHostsAndNonHttpsProductionUrls() {
        stubStudioHost("https://studio.example.com");
        when(tenantDomainRepository.findByTenantIdAndHostIgnoreCase(TENANT_ID, "evil.example.com"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> validator.requireAllowedUrl(
                TENANT_ID,
                "http://evil.example.com/path",
                "returnUrl"
        )).hasMessageContaining("HTTPS");
        assertThatThrownBy(() -> validator.requireAllowedUrl(
                TENANT_ID,
                "https://evil.example.com/path",
                "returnUrl"
        )).hasMessageContaining("not allowed");
    }

    @Test
    void defaultPublicUrlUsesPrimaryDomain() {
        TenantDomain primary = tenantDomain("podcast.example.com", true);
        when(tenantDomainRepository.findByTenantId(TENANT_ID)).thenReturn(List.of(primary));

        assertThat(validator.defaultPublicUrl(TENANT_ID, "/billing/success"))
                .isEqualTo("https://podcast.example.com/billing/success");
    }

    @Test
    void defaultStudioUrlUsesConfiguredBase() {
        stubStudioHost("https://studio.example.com/");

        assertThat(validator.defaultStudioUrl("/settings/stripe"))
                .isEqualTo("https://studio.example.com/settings/stripe");
    }

    private void stubStudioHost(String studioBaseUrl) {
        lenient().when(directwerkConfig.email()).thenReturn(new DirectwerkProperties.Email(
                "smtp",
                "noreply@example.com",
                "Directwerk",
                studioBaseUrl,
                null,
                null,
                null,
                null,
                30L
        ));
    }

    private static TenantDomain tenantDomain(String host, boolean primary) {
        TenantDomain domain = new TenantDomain();
        domain.setHost(host);
        domain.setPrimary(primary);
        domain.setVerified(true);
        return domain;
    }
}
