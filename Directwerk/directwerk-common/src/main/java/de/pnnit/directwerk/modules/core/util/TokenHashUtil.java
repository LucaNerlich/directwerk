package de.pnnit.directwerk.modules.core.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

public final class TokenHashUtil {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** Minimum entropy enforced by security rule 1 (128 bits). */
    private static final int MIN_TOKEN_BYTES = 16;

    private TokenHashUtil() {
    }

    public static String generateUrlSafeToken(int byteLength) {
        if (byteLength < MIN_TOKEN_BYTES) {
            throw new IllegalArgumentException("Token must be at least 128 bits (16 bytes)");
        }
        byte[] tokenBytes = new byte[byteLength];
        SECURE_RANDOM.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    public static String sha256Hex(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 not available", ex);
        }
    }
}
