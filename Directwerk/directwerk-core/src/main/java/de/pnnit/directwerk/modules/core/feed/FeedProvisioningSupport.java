package de.pnnit.directwerk.modules.core.feed;

import de.pnnit.directwerk.modules.core.util.TokenHashUtil;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Shared custom-feed provisioning workflow behind the podcast and article feed twins.
 *
 * <p>{@code SubscriberFeedService} and {@code ArticleFeedService} serve different content
 * kinds (formats vs categories, different rows and error types) but run the same workflow:
 * title policy, custom-feed limit, unique token issuance, and unique-constraint race
 * translation. Kind-specific pieces arrive as lambdas (exception factories, repository
 * probes) so the policy — limits, issuance loop, race handling — lives in exactly one
 * place. Error {@code code} strings are shared feed-builder vocabulary
 * ({@code FEED_LIMIT_REACHED}, {@code FEED_TITLE_DUPLICATE}, {@code FEED_TITLE_INVALID}),
 * not per-kind inventions.
 */
public final class FeedProvisioningSupport {

    public static final int MAX_CUSTOM_FEEDS_PER_USER = 5;
    public static final int MAX_TITLE_LENGTH = 80;
    public static final int PREVIEW_SAMPLE_SIZE = 5;

    private FeedProvisioningSupport() {
    }

    /** Raw, protected, and blind-index forms of one freshly issued feed token. */
    public record IssuedToken(String rawToken, String protectedToken, String tokenHash) {
    }

    public static String normalizeTitle(
            String rawTitle,
            BiFunction<String, String, RuntimeException> badRequest
    ) {
        if (rawTitle == null || rawTitle.isBlank()) {
            throw badRequest.apply("FEED_TITLE_INVALID", "Feed title is required");
        }
        String title = rawTitle.trim();
        if (title.length() > MAX_TITLE_LENGTH) {
            throw badRequest.apply(
                    "FEED_TITLE_INVALID",
                    "Feed title must be at most " + MAX_TITLE_LENGTH + " characters"
            );
        }
        return title;
    }

    public static void requireBelowCustomFeedLimit(
            long customFeedCount,
            BiFunction<String, String, RuntimeException> conflict
    ) {
        if (customFeedCount >= MAX_CUSTOM_FEEDS_PER_USER) {
            throw conflict.apply(
                    "FEED_LIMIT_REACHED",
                    "At most " + MAX_CUSTOM_FEEDS_PER_USER + " custom feeds are allowed"
            );
        }
    }

    /**
     * Issues a token no existing feed uses: raw randomness, protected form for the
     * {@code feed_token} column, SHA-256 hex for the {@code feed_token_hash} blind index.
     *
     * @param generate randomness source (feed-token generator)
     * @param existsByTokenHash blind-index probe, e.g. a repository existence check
     * @param protect at-rest protection, e.g. the token protector
     */
    public static IssuedToken issueUniqueToken(
            Supplier<String> generate,
            Predicate<String> existsByTokenHash,
            Function<String, String> protect
    ) {
        String rawToken;
        do {
            rawToken = generate.get();
        } while (existsByTokenHash.test(TokenHashUtil.sha256Hex(rawToken)));
        return new IssuedToken(rawToken, protect.apply(rawToken), TokenHashUtil.sha256Hex(rawToken));
    }

    /**
     * Matches a persistence failure against one unique-constraint fragment, so concurrent
     * inserts that lose a race translate to the same conflict the pre-checks produce —
     * instead of leaking a 500. The article twin already handled its default-feed race
     * this way; the podcast twin did not (lost-update fix, now shared).
     */
    public static boolean isUniqueConstraintViolation(
            DataIntegrityViolationException ex,
            String constraintNameFragment
    ) {
        if (ex.getCause() instanceof ConstraintViolationException constraintViolation) {
            String constraintName = constraintViolation.getConstraintName();
            return constraintName != null && constraintName.contains(constraintNameFragment);
        }
        return false;
    }
}
