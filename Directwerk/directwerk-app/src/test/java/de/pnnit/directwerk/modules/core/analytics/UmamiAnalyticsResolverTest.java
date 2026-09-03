package de.pnnit.directwerk.modules.core.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UmamiAnalyticsResolverTest {

    @Mock
    private DirectwerkConfig directwerkConfig;

    @Test
    void prefersRoutableTenantHostOverPlatform() {
        TenantBranding branding = new TenantBranding();
        branding.setUmamiHostUrl("https://8.8.8.8");

        assertThat(UmamiAnalyticsResolver.resolveHostUrl(branding, directwerkConfig))
                .isEqualTo("https://8.8.8.8");
    }

    @Test
    void fallsBackToPlatformWhenTenantHostIsPrivate() {
        TenantBranding branding = new TenantBranding();
        branding.setUmamiHostUrl("https://127.0.0.1");
        when(directwerkConfig.isAnalyticsEnabled()).thenReturn(true);
        when(directwerkConfig.analytics()).thenReturn(new DirectwerkProperties.Analytics(
                true, "https://umami.example.test", "Directwerk-Test/1.0"));

        assertThat(UmamiAnalyticsResolver.resolveHostUrl(branding, directwerkConfig))
                .isEqualTo("https://umami.example.test");
    }

    @Test
    void returnsNullWhenNeitherTenantNorPlatformConfigured() {
        when(directwerkConfig.isAnalyticsEnabled()).thenReturn(false);

        assertThat(UmamiAnalyticsResolver.resolveHostUrl(new TenantBranding(), directwerkConfig))
                .isNull();
    }

    @Test
    void selectsEventHostWithoutWaitingForDnsValidation() {
        TenantBranding branding = new TenantBranding();
        branding.setUmamiHostUrl("https://tenant.invalid");

        assertThat(UmamiAnalyticsResolver.resolveEventHostUrl(branding, directwerkConfig))
                .isEqualTo("https://tenant.invalid");
    }
}
