package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import org.junit.jupiter.api.Test;

class PasswordResetRateLimiterTest {

    private PasswordResetRateLimiter limiter(int limit) {
        DirectwerkConfig config = mock(DirectwerkConfig.class);
        DirectwerkProperties.Security security = mock(DirectwerkProperties.Security.class);
        when(security.forgotPasswordRateLimitPerMinute()).thenReturn(limit);
        when(config.properties()).thenReturn(mock(DirectwerkProperties.class));
        when(config.properties().security()).thenReturn(security);
        return new PasswordResetRateLimiter(config);
    }

    @Test
    void allowsTheCeilingThenRefusesTheSameAccount() {
        PasswordResetRateLimiter limiter = limiter(2);

        assertThat(limiter.tryAcquire("Victim@Example.com")).isTrue();
        assertThat(limiter.tryAcquire("victim@example.com")).isTrue();
        assertThat(limiter.tryAcquire("victim@example.com")).isFalse();
    }

    @Test
    void keepsOtherAccountsIndependent() {
        PasswordResetRateLimiter limiter = limiter(1);

        assertThat(limiter.tryAcquire("one@example.com")).isTrue();
        assertThat(limiter.tryAcquire("two@example.com")).isTrue();
    }
}
