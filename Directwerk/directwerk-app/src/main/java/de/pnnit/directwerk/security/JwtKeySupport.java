package de.pnnit.directwerk.security;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.StringUtils;

public final class JwtKeySupport {

    private static final Logger log = LoggerFactory.getLogger(JwtKeySupport.class);

    private JwtKeySupport() {
    }

    public static KeyPair resolveKeyPair(String privateKeyPem, String publicKeyPem) {
        boolean hasPrivateKey = StringUtils.hasText(privateKeyPem);
        boolean hasPublicKey = StringUtils.hasText(publicKeyPem);
        if (hasPrivateKey != hasPublicKey) {
            throw new IllegalStateException(
                    "JWT signing keys must both be configured or both omitted; partial configuration is invalid"
            );
        }
        if (hasPrivateKey && hasPublicKey) {
            return new KeyPair(loadPublicKey(publicKeyPem), loadPrivateKey(privateKeyPem));
        }
        log.warn("JWT signing keys not configured; generating ephemeral RSA key pair");
        return generateRsaKey();
    }

    public static String deriveKeyId(RSAPublicKey publicKey) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(publicKey.getEncoded());
            return HexFormat.of().formatHex(hash, 0, 8);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to derive JWT key id", ex);
        }
    }

    private static KeyPair generateRsaKey() {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(2048);
            return keyPairGenerator.generateKeyPair();
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to generate RSA key pair", ex);
        }
    }

    private static RSAPrivateKey loadPrivateKey(String pem) {
        try {
            byte[] decoded = decodePem(pem);
            PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(decoded);
            return (RSAPrivateKey) KeyFactory.getInstance("RSA").generatePrivate(spec);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to load JWT private key", ex);
        }
    }

    private static RSAPublicKey loadPublicKey(String pem) {
        try {
            byte[] decoded = decodePem(pem);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(decoded);
            return (RSAPublicKey) KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to load JWT public key", ex);
        }
    }

    private static byte[] decodePem(String pem) {
        String normalized = pem
                .replace("\\n", "\n")
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s", "");
        return Base64.getDecoder().decode(normalized.getBytes(StandardCharsets.UTF_8));
    }
}
