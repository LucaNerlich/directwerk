package de.pnnit.directwerk.modules.core.service;

import de.pnnit.directwerk.modules.core.util.EnvelopeTokenProtector;
import org.springframework.stereotype.Component;

/**
 * Thin adapter over {@link EnvelopeTokenProtector} for feed bearer tokens
 * (podcast subscriber feeds, article feeds).
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

    private final EnvelopeTokenProtector envelopeTokenProtector;

    public FeedTokenProtector(EnvelopeTokenProtector envelopeTokenProtector) {
        this.envelopeTokenProtector = envelopeTokenProtector;
    }

    public String protect(String rawToken) {
        return envelopeTokenProtector.protect(rawToken);
    }

    /**
     * @param storedToken the persisted {@code feed_token} value
     * @return the cleartext bearer token; legacy unprefixed rows pass through
     *         (see the shared protector's reveal) so pre-migration rows keep working
     */
    public String reveal(String storedToken) {
        return envelopeTokenProtector.reveal(storedToken);
    }
}
