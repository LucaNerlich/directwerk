package de.pnnit.directwerk.modules.core.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Shared feed-provisioning policy behind the podcast and article feed twins: one title
 * rule, one limit, one issuance loop, one race translation.
 */
class FeedProvisioningSupportTest {

    @Test
    void limitsAreTheSharedFeedBuilderPolicy() {
        assertThat(FeedProvisioningSupport.MAX_CUSTOM_FEEDS_PER_USER).isEqualTo(25);
        assertThat(FeedProvisioningSupport.MAX_TITLE_LENGTH).isEqualTo(80);
        assertThat(FeedProvisioningSupport.PREVIEW_SAMPLE_SIZE).isEqualTo(5);
    }

    @Test
    void normalizeTitleTrimsAndEnforcesLength() {
        assertThat(FeedProvisioningSupport.normalizeTitle("  hello  ", TestErrors::badRequest))
                .isEqualTo("hello");
        assertThatThrownBy(() -> FeedProvisioningSupport.normalizeTitle("  ", TestErrors::badRequest))
                .isInstanceOf(TestErrors.class)
                .hasMessageContaining("FEED_TITLE_INVALID");
        assertThatThrownBy(() -> FeedProvisioningSupport.normalizeTitle(null, TestErrors::badRequest))
                .isInstanceOf(TestErrors.class);
        assertThatThrownBy(() -> FeedProvisioningSupport.normalizeTitle(
                        "x".repeat(FeedProvisioningSupport.MAX_TITLE_LENGTH + 1), TestErrors::badRequest))
                .isInstanceOf(TestErrors.class);
    }

    @Test
    void customFeedLimitThrowsAtTheBoundary() {
        FeedProvisioningSupport.requireBelowCustomFeedLimit(
                FeedProvisioningSupport.MAX_CUSTOM_FEEDS_PER_USER - 1, TestErrors::conflict);
        assertThatThrownBy(() -> FeedProvisioningSupport.requireBelowCustomFeedLimit(
                        FeedProvisioningSupport.MAX_CUSTOM_FEEDS_PER_USER, TestErrors::conflict))
                .isInstanceOf(TestErrors.class)
                .hasMessageContaining("FEED_LIMIT_REACHED");
    }

    @Test
    void issueUniqueTokenRetriesCollisionsAndReturnsAllThreeForms() {
        Set<String> taken = new HashSet<>(Set.of("aaa"));
        AtomicInteger calls = new AtomicInteger();
        java.util.function.Supplier<String> generate =
                () -> calls.getAndIncrement() == 0 ? "aaa" : "bbb";

        FeedProvisioningSupport.IssuedToken issued = FeedProvisioningSupport.issueUniqueToken(
                generate,
                hash -> taken.contains(hash) || hash.equals(sha("aaa")),
                raw -> "protected:" + raw);

        assertThat(issued.rawToken()).isEqualTo("bbb");
        assertThat(issued.protectedToken()).isEqualTo("protected:bbb");
        assertThat(issued.tokenHash()).isEqualTo(sha("bbb"));
    }

    @Test
    void uniqueConstraintViolationMatchesFragmentsOnly() {
        DataIntegrityViolationException match = new DataIntegrityViolationException(
                "duplicate", new ConstraintViolationException("dup", null, "uq_subscriber_feeds_default"));
        DataIntegrityViolationException other = new DataIntegrityViolationException(
                "duplicate", new ConstraintViolationException("dup", null, "uq_other_table"));
        DataIntegrityViolationException noCause = new DataIntegrityViolationException("boom");

        assertThat(FeedProvisioningSupport.isUniqueConstraintViolation(match, "uq_subscriber_feeds_default"))
                .isTrue();
        assertThat(FeedProvisioningSupport.isUniqueConstraintViolation(other, "uq_subscriber_feeds_default"))
                .isFalse();
        assertThat(FeedProvisioningSupport.isUniqueConstraintViolation(noCause, "uq_subscriber_feeds_default"))
                .isFalse();
    }

    private static String sha(String raw) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            StringBuilder hex = new StringBuilder();
            for (byte b : digest.digest(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }

    /** Stand-in for the per-kind builder exceptions (same factory shape). */
    private static final class TestErrors extends RuntimeException {
        TestErrors(String code, String message) {
            super(code + ": " + message);
        }

        static TestErrors badRequest(String code, String message) {
            return new TestErrors(code, message);
        }

        static TestErrors conflict(String code, String message) {
            return new TestErrors(code, message);
        }
    }
}
