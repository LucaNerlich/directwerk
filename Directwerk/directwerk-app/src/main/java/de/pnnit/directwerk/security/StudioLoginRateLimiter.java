package de.pnnit.directwerk.security;

import de.pnnit.directwerk.modules.core.exception.RateLimitExceededException;
import de.pnnit.directwerk.modules.core.util.EmailNormalizer;
import org.springframework.stereotype.Component;

/**
 * Per-account rate limit for the shared-studio JSON login (issue #552).
 *
 * <p>{@code POST /api/v1/auth/studio/workspaces} verifies a password, so it needs the same
 * per-account ceiling {@code /oauth2/token} has (10/min/username) instead of relying on the
 * 20/min per-IP filter alone — otherwise credential stuffing across many source IPs is
 * unthrottled. A servlet filter cannot key on the JSON body, so the check runs here.</p>
 */
@Component
public class StudioLoginRateLimiter {

    private final FixedWindowRateLimiter limiter = new FixedWindowRateLimiter();
    private final int maxAttemptsPerMinute;

    /**
     * @param directwerkConfig the platform config; the ceiling is the same {@code
     *                         /oauth2/token} uses, so the two login paths cannot drift (#751)
     */
    public StudioLoginRateLimiter(de.pnnit.directwerk.config.DirectwerkConfig directwerkConfig) {
        Integer configured = directwerkConfig.properties() != null
                && directwerkConfig.properties().security() != null
                ? directwerkConfig.properties().security().oauthTokenRateLimitPerMinute()
                : null;
        this.maxAttemptsPerMinute = configured != null && configured > 0 ? configured : 10;
    }

    /**
     * Counts one attempt for the account and rejects the request once the ceiling is reached.
     *
     * @param email the submitted account email
     * @throws RateLimitExceededException when the account exceeded its per-minute allowance
     */
    public void requireWithinLimit(String email) {
        String key = "studio-login:" + EmailNormalizer.normalize(email);
        if (limiter.isRateLimited(key, maxAttemptsPerMinute)) {
            throw new RateLimitExceededException();
        }
    }
}
