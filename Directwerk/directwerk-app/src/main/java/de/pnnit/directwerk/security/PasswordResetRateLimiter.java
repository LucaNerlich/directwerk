package de.pnnit.directwerk.security;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.exception.RateLimitExceededException;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import org.springframework.stereotype.Component;

/**
 * Per-account rate limit for {@code POST /api/v1/auth/forgot-password}.
 *
 * <p>The servlet filter can only key on the source IP, so a botnet could mail-bomb one address
 * (and invalidate the link the victim already holds) from many IPs. A servlet filter cannot read
 * the JSON body, so the per-email ceiling runs here, mirroring {@link StudioLoginRateLimiter}.</p>
 */
@Component
public class PasswordResetRateLimiter {

    private final FixedWindowRateLimiter limiter = new FixedWindowRateLimiter();
    private final int maxAttemptsPerMinute;

    /**
     * @param directwerkConfig the platform config; uses the same forgot-password ceiling as the
     *                         per-IP filter so the two cannot drift
     */
    public PasswordResetRateLimiter(DirectwerkConfig directwerkConfig) {
        Integer configured = directwerkConfig.properties() != null
                && directwerkConfig.properties().security() != null
                ? directwerkConfig.properties().security().forgotPasswordRateLimitPerMinute()
                : null;
        this.maxAttemptsPerMinute = configured != null && configured > 0 ? configured : 5;
    }

    /**
     * Counts one request for the account and rejects once the ceiling is reached.
     *
     * @param email the submitted account email
     * @throws RateLimitExceededException when the account exceeded its per-minute allowance
     */
    public void requireWithinLimit(String email) {
        String key = "password-reset:" + EmailNormalizer.normalize(email);
        if (limiter.isRateLimited(key, maxAttemptsPerMinute)) {
            throw new RateLimitExceededException();
        }
    }
}
