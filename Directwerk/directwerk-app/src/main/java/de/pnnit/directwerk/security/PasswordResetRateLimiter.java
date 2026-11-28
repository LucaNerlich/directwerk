package de.pnnit.directwerk.security;

import de.pnnit.directwerk.config.DirectwerkConfig;
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
     * Counts one request for the account.
     *
     * @param email the submitted account email
     * @return {@code true} when the request is within the allowance; {@code false} when the
     * account exceeded it. Callers must answer the normal accepted response either way, so an
     * attacker cannot use 429s to confirm an address or keep the owner locked out.
     */
    public boolean tryAcquire(String email) {
        String key = "password-reset:" + EmailNormalizer.normalize(email);
        return !limiter.isRateLimited(key, maxAttemptsPerMinute);
    }
}
