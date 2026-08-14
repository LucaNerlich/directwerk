package de.pnnit.directwerk.modules.core.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.util.StringUtils;

/**
 * AES-256-GCM envelope encryption for short-lived secrets stored in durable queues.
 */
public final class EnvelopeCipher {

    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final String PREFIX = "enc:v1:";

    private EnvelopeCipher() {
    }

    public static String encrypt(String plaintext, String keyMaterial) {
        if (!StringUtils.hasText(plaintext)) {
            throw new IllegalArgumentException("Plaintext is required");
        }
        requireKeyMaterial(keyMaterial);
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            SecureRandom secureRandom = new SecureRandom();
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, deriveKey(keyMaterial), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] payload = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(ciphertext, 0, payload, iv.length, ciphertext.length);
            return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to encrypt queue payload secret", ex);
        }
    }

    public static String decrypt(String ciphertext, String keyMaterial) {
        if (!StringUtils.hasText(ciphertext)) {
            throw new IllegalArgumentException("Ciphertext is required");
        }
        if (!ciphertext.startsWith(PREFIX)) {
            return ciphertext;
        }
        requireKeyMaterial(keyMaterial);
        try {
            byte[] payload = Base64.getUrlDecoder().decode(ciphertext.substring(PREFIX.length()));
            byte[] iv = new byte[GCM_IV_LENGTH];
            byte[] encrypted = new byte[payload.length - GCM_IV_LENGTH];
            System.arraycopy(payload, 0, iv, 0, GCM_IV_LENGTH);
            System.arraycopy(payload, GCM_IV_LENGTH, encrypted, 0, encrypted.length);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, deriveKey(keyMaterial), new GCMParameterSpec(GCM_TAG_LENGTH, iv));
            byte[] plaintext = cipher.doFinal(encrypted);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to decrypt queue payload secret", ex);
        }
    }

    private static SecretKeySpec deriveKey(String keyMaterial) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest(keyMaterial.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(hash, "AES");
    }

    private static void requireKeyMaterial(String keyMaterial) {
        if (!StringUtils.hasText(keyMaterial)) {
            throw new IllegalStateException("Queue payload encryption key material is not configured");
        }
    }
}
