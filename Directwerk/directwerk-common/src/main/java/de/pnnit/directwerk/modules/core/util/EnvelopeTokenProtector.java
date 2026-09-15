package de.pnnit.directwerk.modules.core.util;

import de.pnnit.directwerk.config.DirectwerkConfig;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Deep module owning the signed-envelope token seam: AES-256-GCM envelope
 * protection ({@link EnvelopeCipher}) keyed from the OAuth client secrets.
 *
 * <p>Feed bearer tokens (podcast subscriber feeds, article feeds) and queued
 * email tokens are the same secret-at-rest problem, so both delegate here and
 * share one key derivation. Raw values must remain recoverable server-side —
 * snapshot jobs embed feed tokens into enclosure URLs, API views return them to
 * owners, and queue jobs rebuild email links — so hashing (as used for
 * reset/invite tokens) is not applicable. Encryption keeps database dumps,
 * backups, read replicas, and durable queue payloads from impersonating tokens
 * as long as the key material (OAuth client secrets, never stored in the
 * database) stays disclosure-free.
 *
 * <p>Lookups use separate SHA-256 blind-index columns where applicable;
 * presenting a hash never matches because lookups hash the presented value first.
 */
@Component
public class EnvelopeTokenProtector {

    private final DirectwerkConfig directwerkConfig;

    public EnvelopeTokenProtector(DirectwerkConfig directwerkConfig) {
        this.directwerkConfig = directwerkConfig;
    }

    public String protect(String rawToken) {
        return EnvelopeCipher.encrypt(rawToken, keyMaterial());
    }

    /**
     * @param storedToken the persisted {@code enc:v1:...} value; legacy unprefixed
     *                    values pass through (see {@link EnvelopeCipher#decrypt})
     * @return the cleartext token
     */
    public String reveal(String storedToken) {
        return EnvelopeCipher.decrypt(storedToken, keyMaterial());
    }

    private String keyMaterial() {
        String platformSecret = directwerkConfig.security().platformClientSecret();
        String tenantSecret = directwerkConfig.security().tenantClientSecret();
        if (!StringUtils.hasText(platformSecret) || !StringUtils.hasText(tenantSecret)) {
            throw new IllegalStateException("OAuth client secrets must be configured for token protection");
        }
        return platformSecret + "|" + tenantSecret;
    }
}
