package de.pnnit.directwerk.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import de.pnnit.directwerk.modules.core.exception.RateLimitExceededException;
import org.junit.jupiter.api.Test;

/**
 * Issue #552: the shared-studio JSON login needs a per-account bucket, not just the per-IP filter.
 */
class StudioLoginRateLimiterTest {

    private final StudioLoginRateLimiter limiter = new StudioLoginRateLimiter();

    @Test
    void allowsTwentyAttemptsPerAccountThenRejectsTheNext() {
        for (int attempt = 0; attempt < StudioLoginRateLimiter.MAX_ATTEMPTS_PER_MINUTE; attempt++) {
            assertThatCode(() -> limiter.requireWithinLimit("editor@example.com"))
                    .doesNotThrowAnyException();
        }

        assertThatThrownBy(() -> limiter.requireWithinLimit("editor@example.com"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void throttlesOneAccountWithoutBlockingAnother() {
        for (int attempt = 0; attempt < StudioLoginRateLimiter.MAX_ATTEMPTS_PER_MINUTE; attempt++) {
            limiter.requireWithinLimit("editor@example.com");
        }

        assertThatCode(() -> limiter.requireWithinLimit("other@example.com"))
                .doesNotThrowAnyException();
    }

    @Test
    void keysOnTheNormalizedEmail() {
        for (int attempt = 0; attempt < StudioLoginRateLimiter.MAX_ATTEMPTS_PER_MINUTE; attempt++) {
            limiter.requireWithinLimit("  Editor@Example.COM ");
        }

        assertThatThrownBy(() -> limiter.requireWithinLimit("editor@example.com"))
                .isInstanceOf(RateLimitExceededException.class);
    }
}
