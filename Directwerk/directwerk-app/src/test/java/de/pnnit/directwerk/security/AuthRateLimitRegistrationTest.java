package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.servlet.FilterRegistrationBean;

class AuthRateLimitRegistrationTest {

    @Test
    void everyRegisteredUrlPatternIsAServletValidPattern() {
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        DirectwerkProperties.Security security = mock(DirectwerkProperties.Security.class);
        when(security.oauthTokenRateLimitPerMinute()).thenReturn(10);
        when(security.forgotPasswordRateLimitPerMinute()).thenReturn(5);
        when(security.authRateLimitPerMinute()).thenReturn(20);
        when(config.security()).thenReturn(security);
        DirectwerkProperties.Marketing marketing = mock(DirectwerkProperties.Marketing.class);
        DirectwerkProperties.Contact contact = mock(DirectwerkProperties.Contact.class);
        when(contact.rateLimitPerMinute()).thenReturn(5);
        when(marketing.contact()).thenReturn(contact);
        when(config.marketing()).thenReturn(marketing);

        FilterRegistrationBean<AuthRateLimitFilter> registration =
                new SecurityConfig().authRateLimitFilterRegistration(config);

        // A servlet pattern allows only an exact path, a trailing wildcard or an extension —
        // a star in the middle makes the whole pattern invalid and silently unmapped.
        assertThat(registration.getUrlPatterns()).isNotEmpty();
        assertThat(registration.getUrlPatterns()).allSatisfy(pattern ->
                assertThat(pattern.indexOf('*') == -1 || pattern.endsWith("/*"))
                        .as("invalid servlet URL pattern: %s", pattern)
                        .isTrue());
        assertThat(registration.getUrlPatterns()).contains(
                "/oauth2/token",
                "/api/v1/auth/*",
                "/api/v1/public/newsletter-lists/*"
        );
    }
}
