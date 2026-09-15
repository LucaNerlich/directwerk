package de.pnnit.directwerk.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.entity.TenantBranding;
import de.pnnit.directwerk.modules.core.service.TenantBrandingService;
import java.net.SocketTimeoutException;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
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
    @Mock
    private AnalyticsQueryService.RequestSender requestSender;

    private AnalyticsQueryService service() {
        return new AnalyticsQueryService(directwerkConfig, tenantBrandingService, new ObjectMapper());
    }

    private AnalyticsQueryService service(AnalyticsQueryService.RequestSender sender) {
        return new AnalyticsQueryService(directwerkConfig, tenantBrandingService, new ObjectMapper(), sender);
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
        branding.setUmamiHostUrl("https://8.8.8.8");
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);
        when(directwerkConfig.analytics()).thenReturn(
                new DirectwerkProperties.Analytics(true, "https://8.8.8.8", null));

        assertThatThrownBy(() -> service().query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_CREDENTIALS_MISSING");
    }

    @Test
    void rejectsTenantHostOutsideConfiguredDestinationsBeforeSendingCredentials() throws Exception {
        TenantBranding branding = branding("https://8.8.8.8");
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding);
        when(directwerkConfig.analytics()).thenReturn(analytics("https://1.1.1.1"));

        assertThatThrownBy(() -> service(requestSender).query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_HOST_INVALID");
        verify(requestSender, never()).send(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsAllowedButPrivateDestinationBeforeSendingCredentials() throws Exception {
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding("https://127.0.0.1"));
        when(directwerkConfig.analytics()).thenReturn(analytics("https://127.0.0.1"));

        assertThatThrownBy(() -> service(requestSender).query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_HOST_INVALID");
        verify(requestSender, never()).send(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void mapsOnlyLoginAuthenticationFailuresToUnauthorized() {
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding("https://8.8.8.8"));
        when(directwerkConfig.analytics()).thenReturn(analytics("https://8.8.8.8"));

        assertThatThrownBy(() -> service((uri, body, token) ->
                new AnalyticsQueryService.HttpResult(401, "")).query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_UNAUTHORIZED");

        assertThatThrownBy(() -> service((uri, body, token) ->
                new AnalyticsQueryService.HttpResult(500, "")).query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_UNAVAILABLE");
    }

    @Test
    void preservesTimeoutAndInvalidLoginResponseErrors() {
        when(tenantBrandingService.getBranding(10L)).thenReturn(branding("https://8.8.8.8"));
        when(directwerkConfig.analytics()).thenReturn(analytics("https://8.8.8.8"));

        assertThatThrownBy(() -> service((uri, body, token) -> {
            throw new SocketTimeoutException("timeout");
        }).query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_TIMEOUT");

        assertThatThrownBy(() -> service((uri, body, token) ->
                new AnalyticsQueryService.HttpResult(200, "{}"))
                .query(10L, AnalyticsRange.SEVEN_DAYS))
                .isInstanceOf(AnalyticsQueryException.class)
                .extracting(ex -> ((AnalyticsQueryException) ex).getCode())
                .isEqualTo("UMAMI_INVALID_RESPONSE");
    }

    @Test
    void doesNotReuseCachedTokenAcrossUmamiHosts() {
        when(tenantBrandingService.getBranding(10L)).thenReturn(
                branding("https://8.8.8.8"), branding("https://1.1.1.1"));
        when(directwerkConfig.analytics()).thenReturn(new DirectwerkProperties.Analytics(
                true, "", null, "", List.of("8.8.8.8", "1.1.1.1"), "user", "pass"));
        AtomicInteger loginCount = new AtomicInteger();
        AnalyticsQueryService.RequestSender sender = (uri, body, token) -> {
            if (uri.getPath().endsWith("/api/auth/login")) {
                return new AnalyticsQueryService.HttpResult(200, "{\"token\":\"token-" + loginCount.incrementAndGet() + "\"}");
            }
            if (uri.getPath().endsWith("/stats")) {
                return new AnalyticsQueryService.HttpResult(
                        200, "{\"pageviews\":1,\"visitors\":1,\"visits\":1,\"bounces\":0}");
            }
            return new AnalyticsQueryService.HttpResult(200, "{}");
        };
        AnalyticsQueryService service = service(sender);

        service.query(10L, AnalyticsRange.SEVEN_DAYS);
        service.query(10L, AnalyticsRange.SEVEN_DAYS);

        assertThat(loginCount).hasValue(2);
    }

    private static TenantBranding branding(String host) {
        TenantBranding branding = new TenantBranding();
        branding.setUmamiWebsiteId("abcdefgh");
        branding.setUmamiHostUrl(host);
        return branding;
    }

    private static DirectwerkProperties.Analytics analytics(String configuredHost) {
        return new DirectwerkProperties.Analytics(true, configuredHost, null, "", "user", "pass");
    }
}
