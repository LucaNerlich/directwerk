package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.config.DirectwerkConfig;
import de.pnnit.directwerk.modules.core.util.EnvelopeCipher;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Encrypts feed bearer tokens (podcast subscriber feeds, article feeds) at rest
 * with AES-256-GCM via {@link EnvelopeCipher}.
 *
 * <p>Raw tokens must remain recoverable server-side: background snapshot jobs embed
 * them into enclosure URLs and API views return them to owners, so hashing (as used
 * for reset/invite tokens) is not applicable here. Encryption keeps database dumps,
 * backups, and read replicas from impersonating feeds as long as the key material
 * (OAuth client secrets, never stored in the database) stays disclosure-free.
 *
 * <p>Lookups use a separate SHA-256 blind-index column ({@code feed_token_hash});
 * presenting a hash never matches because lookups hash the presented value first.
 */
@Component
public class FeedTokenProtector {

    private final DirectwerkConfig directwerkConfig;

    public FeedTokenProtector(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    public String protect(String rawToken) {
        return EnvelopeCipher.encrypt(rawToken, keyMaterial());
    }

    /**
     * @param storedToken the persisted {@code feed_token} value
     * @return the cleartext bearer token; legacy unprefixed rows pass through
     *         (see {@link EnvelopeCipher#decrypt}) so pre-migration rows keep working
     */
    public String reveal(String storedToken) {
        return EnvelopeCipher.decrypt(storedToken, keyMaterial());
    }

    private String keyMaterial() {
        String platformSecret = directwerkConfig.security().platformClientSecret();
        String tenantSecret = directwerkConfig.security().tenantClientSecret();
        if (!StringUtils.hasText(platformSecret) || !StringUtils.hasText(tenantSecret)) {
            throw new IllegalStateException("OAuth client secrets must be configured for feed token protection");
        }
        return platformSecret + "|" + tenantSecret;
    }
}
