package de.pnnit.directwerk.bootstrap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import de.pnnit.directwerk.security.BillingRateLimitFilter;
import de.pnnit.directwerk.security.PlatformAdminGuardFilter;
import de.pnnit.directwerk.security.TenantApiKeyAuthenticationFilter;
import org.junit.jupiter.api.Test;

/**
 * Chain-only filters must opt out of Spring Boot's servlet auto-registration, or they run a
 * second time after the security chain (double rate-limit counting, duplicate key writes).
 */
class ApplicationConfigTest {

    private final ApplicationConfig config = new ApplicationConfig();

    @Test
    void chainOnlyFiltersAreNotAutoRegisteredAsServletFilters() {
        assertThat(config.disableBillingRateLimitFilterAutoRegistration(
                mock(BillingRateLimitFilter.class)).isEnabled()).isFalse();
        assertThat(config.disableTenantApiKeyFilterAutoRegistration(
                mock(TenantApiKeyAuthenticationFilter.class)).isEnabled()).isFalse();
        assertThat(config.disablePlatformAdminGuardAutoRegistration(
                mock(PlatformAdminGuardFilter.class)).isEnabled()).isFalse();
    }
}
