package de.pnnit.directwerk.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "directwerk")
public record DirectwerkProperties(
        @Valid Security security,
        Dev dev,
        Account account,
        Bootstrap bootstrap,
        @Valid Email email,
        @Valid Queue queue,
        @Valid Storage storage,
        @Valid Analytics analytics,
        @Valid Marketing marketing
) {

    public DirectwerkProperties {
        marketing = marketing == null ? new Marketing(null) : marketing;
    }

    public record Security(
            String issuer,
            String audience,
            String platformClientId,
            String tenantClientId,
            String platformClientSecret,
            String tenantClientSecret,
            String jwtPrivateKey,
            String jwtPublicKey,
            @Pattern(regexp = "jdbc|memory", message = "must be jdbc or memory")
            String authorizationStore,
            @Positive Integer oauthTokenRateLimitPerMinute,
            @Positive Integer forgotPasswordRateLimitPerMinute,
            @Positive Integer authRateLimitPerMinute,
            List<String> trustedProxies
    ) {
        public Security {
            trustedProxies = trustedProxies == null ? List.of() : List.copyOf(trustedProxies);
        }
    }

    public record Dev(String seedPassword, String platformAdminEmail, String platformAdminPassword) {
    }

    public record Account(boolean emailVerificationRequired, boolean exposeDevTokens) {
    }

    public record Bootstrap(String platformAdminEmail, String platformAdminPassword) {
    }

    public record Email(
            boolean enabled,
            /**
             * Outbound transport. {@code smtp} is implemented (Mailpit / any SMTP relay).
             * {@code none} keeps jobs and templates but never delivers. Add a new
             * {@code EmailSender} implementation to support Mailgun HTTP, Resend, etc.
             */
            @Pattern(regexp = "none|smtp", message = "must be none or smtp")
            String provider,
            String fromAddress,
            String fromName,
            String studioBaseUrl,
            String adminBaseUrl,
            String acceptInvitePath,
            String resetPasswordPath,
            String verifyEmailPath,
            @Positive long deliveryRetentionDays
    ) {
        public Email {
            if (provider == null || provider.isBlank()) {
                provider = "smtp";
            } else {
                provider = provider.trim().toLowerCase();
            }
        }

        public boolean isDeliveryReady() {
            return enabled && "smtp".equals(provider);
        }
    }

    public record Queue(
            boolean enabled,
            @Positive long pollIntervalMs,
            @Positive int claimLimit,
            /** Max page size for platform job list inspection (independent of claim batch size). */
            @Positive int listLimit,
            @Positive long leaseSeconds,
            @Positive long maxLeaseSeconds,
            @Min(1) int defaultMaxAttempts,
            @Positive long retryDelaySeconds,
            @Positive long maxRetryDelaySeconds,
            @Positive int jsonByteLimit,
            String workerId,
            @Positive long retentionDays,
            @Positive long cleanupIntervalMs,
            @Positive int cleanupBatchSize
    ) {
    }

    public record Analytics(
            boolean enabled,
            String umamiHostUrl,
            String userAgent
    ) {
        public Analytics {
            umamiHostUrl = umamiHostUrl == null ? "" : umamiHostUrl.trim();
            userAgent = userAgent == null || userAgent.isBlank() ? "Directwerk/1.0" : userAgent.trim();
        }

        @AssertTrue(message = "umami-host-url must be an absolute HTTPS URL with a host")
        public boolean isUmamiHostUrlValid() {
            if (umamiHostUrl == null || umamiHostUrl.isBlank()) {
                return true;
            }
            try {
                URI uri = URI.create(umamiHostUrl);
                return uri.isAbsolute()
                        && "https".equalsIgnoreCase(uri.getScheme())
                        && uri.getHost() != null
                        && !uri.getHost().isBlank()
                        && uri.getUserInfo() == null
                        && uri.getRawQuery() == null
                        && uri.getRawFragment() == null;
            } catch (IllegalArgumentException ex) {
                return false;
            }
        }
    }

    public record Marketing(Contact contact) {
        public Marketing {
            contact = contact == null ? new Contact(false, null, 5, List.of(), null) : contact;
        }
    }

    public record Contact(
            boolean enabled,
            String inboxEmail,
            @Positive Integer rateLimitPerMinute,
            List<String> allowedOrigins,
            Altcha altcha
    ) {
        public Contact {
            rateLimitPerMinute = rateLimitPerMinute == null ? 5 : rateLimitPerMinute;
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }

    public record Altcha(
            String hmacKey,
            @Positive Integer expiresSeconds
    ) {
        public Altcha {
            expiresSeconds = expiresSeconds == null ? 300 : expiresSeconds;
        }
    }

    /**
     * S3-compatible object storage (Hetzner / Bunny). Clients are only created when {@code enabled}.
     */
    public record Storage(
            boolean enabled,
            @Pattern(regexp = "hetzner|bunny", message = "must be hetzner or bunny")
            String provider,
            String region,
            String bucket,
            String publicBucket,
            String endpoint,
            boolean forcePathStyle,
            String accessKey,
            String secretKey,
            String publicCdnBaseUrl,
            /**
             * Private Pull Zone base URL (Token Auth). When set with {@code cdnTokenAuthKey},
             * private downloads use Bunny Advanced token URLs instead of S3 presign.
             */
            String privateCdnBaseUrl,
            /** Bunny Pull Zone URL Token Authentication Key for the private PZ (Advanced HMAC-SHA256). */
            String cdnTokenAuthKey,
            Duration presignUploadTtl,
            Duration presignDownloadTtlApi,
            Duration presignDownloadTtlRss,
            @Positive long stagingLifecycleHours,
            /** Interval between app-side staging sweep runs (Bunny has no bucket lifecycle rules). */
            @Positive long stagingCleanupIntervalMs,
            /** Optional Bunny account AccessKey for CDN Purge URL API; blank disables purge. */
            String cdnPurgeApiKey,
            /** Bunny Core API base (default {@code https://api.bunny.net}); override for tests. */
            String cdnPurgeApiBaseUrl
    ) {
    }
}
