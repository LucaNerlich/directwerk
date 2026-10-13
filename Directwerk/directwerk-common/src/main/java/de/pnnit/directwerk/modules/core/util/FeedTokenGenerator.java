package de.pnnit.directwerk.modules.core.util;

import org.springframework.stereotype.Component;

/**
 * Generates feed tokens (podcast subscriber feeds, article feeds, ...): 24 bytes from a
 * cryptographically secure source (192 bits of entropy), base64url-encoded without padding.
 * Delegates to {@link TokenHashUtil#generateUrlSafeToken(int)} so the randomness primitive,
 * its minimum-entropy floor and its alphabet live in exactly one place (issue #354).
 */
@Component
public class FeedTokenGenerator {

    /** 24 bytes = 192 bits of entropy — comfortably above the 128-bit floor. */
    private static final int TOKEN_BYTES = 24;

    public String generate() {
        return TokenHashUtil.generateUrlSafeToken(TOKEN_BYTES);
    }
}
