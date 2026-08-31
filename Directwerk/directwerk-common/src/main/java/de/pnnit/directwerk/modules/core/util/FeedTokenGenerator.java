package de.pnnit.directwerk.modules.core.util;

import java.security.SecureRandom;
import java.util.Base64;
import org.springframework.stereotype.Component;

/**
 * Generates feed tokens (podcast subscriber feeds, article feeds, ...): 24 bytes from
 * {@link SecureRandom} (192 bits of entropy), base64url-encoded without padding. The only
 * place feed-token randomness is produced — entropy, alphabet and length are pinned by
 * {@code FeedTokenGeneratorTest}.
 */
@Component
public class FeedTokenGenerator {

    /** 24 bytes = 192 bits of entropy — comfortably above the 128-bit floor. */
    private static final int TOKEN_BYTES = 24;

    private final SecureRandom secureRandom = new SecureRandom();

    public String generate() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
