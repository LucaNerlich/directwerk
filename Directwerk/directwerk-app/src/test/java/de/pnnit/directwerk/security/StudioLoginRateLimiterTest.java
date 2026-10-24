package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.config.DirectwerkProperties;
import de.pnnit.directwerk.modules.core.exception.RateLimitExceededException;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Issue #552: the shared-studio JSON login needs a per-account bucket, not just the per-IP filter.
 */
class StudioLoginRateLimiterTest {

    private static final int DEFAULT_LIMIT = 10;

    private final StudioLoginRateLimiter limiter = limiterWith(null);

    private static StudioLoginRateLimiter limiterWith(Integer configuredLimit) {
        DirectwerkProperties.Security security = new DirectwerkProperties.Security(
                null, null, null, null, null, null, null, null, null,
                configuredLimit, null, null, null, List.of());
        DirectwerkProperties properties = new DirectwerkProperties(
                security, null, null, null, null, null, null, null, null);
        return new StudioLoginRateLimiter(new DirectwerkConfig(properties));
    }

    @Test
    void allowsTheConfiguredAttemptsPerAccountThenRejectsTheNext() {
        for (int attempt = 0; attempt < DEFAULT_LIMIT; attempt++) {
            assertThatCode(() -> limiter.requireWithinLimit("editor@example.com"))
                    .doesNotThrowAnyException();
        }

        assertThatThrownBy(() -> limiter.requireWithinLimit("editor@example.com"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void throttlesOneAccountWithoutBlockingAnother() {
        for (int attempt = 0; attempt < DEFAULT_LIMIT; attempt++) {
            limiter.requireWithinLimit("editor@example.com");
        }

        assertThatCode(() -> limiter.requireWithinLimit("other@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void keysOnTheNormalizedEmail() {
        for (int attempt = 0; attempt < DEFAULT_LIMIT; attempt++) {
            limiter.requireWithinLimit("  Editor@Example.COM ");
        }

        assertThatThrownBy(() -> limiter.requireWithinLimit("editor@example.com"))
                .isInstanceOf(RateLimitExceededException.class);
    }
}
