package de.pnnit.directwerk.analytics;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class AnalyticsQueryServiceTest {

    @Mock
    private DirectwerkConfig directwerkConfig;
    @Mock
    private TenantBrandingService tenantBrandingService;

    private AnalyticsQueryService service() {
        return new AnalyticsQueryService(directwerkConfig, tenantBrandingService, new ObjectMapper());
    }

    @Test
    void rejectsTenantWithoutWebsiteId() {
        TenantBranding branding = new TenantBranding();
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);

        assertThatThrownBy(() -> service().query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("ANALYTICS_NOT_CONFIGURED");
    }

    @Test
    void rejectsInvalidUmamiHost() {
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("abcdefgh");
        branding.setUmamiHostUrl("not-a-url");
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);
        when(directwerkConfig.analytics()).thenReturn(
                new DirectwerkProperties.Analytics(true, "", null, "", "user", "pass"));

        assertThatThrownBy(() -> service().query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_HOST_INVALID");
    }

    @Test
    void reportsMissingReadApiCredentials() {
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("abcdefgh");
        branding.setUmamiHostUrl("https://umami.example.test");
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);
        when(directwerkConfig.analytics()).thenReturn(
                new DirectwerkProperties.Analytics(true, "", null));

        assertThatThrownBy(() -> service().query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_CREDENTIALS_MISSING");
    }
}
