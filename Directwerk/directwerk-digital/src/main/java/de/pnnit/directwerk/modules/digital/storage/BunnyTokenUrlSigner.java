package de.pnnit.directwerk.modules.digital.storage;

import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Bunny CDN Advanced Token Authentication (HMAC-SHA256, {@code HS256-} prefix).
 *
 * <p>Algorithm matches the official Java sample
 * <a href="https://github.com/BunnyWay/BunnyCDN.TokenAuthentication/blob/master/java/src/main/java/BunnyCDN/TokenSigner.java">BunnyCDN.TokenSigner</a>
 * ({@code BunnyWay/BunnyCDN.TokenAuthentication}, {@code java/} tree). Docs:
 * <a href="https://docs.bunny.net/cdn/security/token-authentication/advanced">Advanced Token Authentication</a>.
 *
 * <p>{@link #signObjectGet} is a Directwerk wrapper for private pull-zone object GETs
 * (query-string file tokens; no directory / geo / IP locking).
 */
public final class BunnyTokenUrlSigner {

    private BunnyTokenUrlSigner() {
    }

    /**
     * Builds a signed GET URL for an object key on the private pull zone.
     *
     * @param privateCdnBaseUrl HTTPS origin of the private PZ (no trailing slash required)
     * @param s3Key             tenant-prefixed object key
     * @param securityKey       Pull Zone URL Token Authentication Key
     * @param ttl               URL lifetime from now
     * @return signed absolute URL with {@code token} and {@code expires} query params
     */
    public static URL signObjectGet(
            String privateCdnBaseUrl,
            String s3Key,
            String securityKey,
            Duration ttl
    ) {
        Objects.requireNonNull(privateCdnBaseUrl, "privateCdnBaseUrl");
        Objects.requireNonNull(s3Key, "s3Key");
        Objects.requireNonNull(securityKey, "securityKey");
        Objects.requireNonNull(ttl, "ttl");
        if (securityKey.isBlank()) {
            throw new IllegalArgumentException("securityKey must not be blank");
        }
        if (ttl.isNegative() || ttl.isZero()) {
            throw new IllegalArgumentException("ttl must be positive");
        }

        String base = requireHttpsBase(privateCdnBaseUrl);
        String key = s3Key.startsWith("/") ? s3Key.substring(1) : s3Key;
        if (key.isBlank() || key.contains("..")) {
            throw new IllegalArgumentException("Invalid object key");
        }
        String unsigned = base + "/" + key;
        long expiresAt = Instant.now().getEpochSecond() + ttl.toSeconds();
        String signed = signUrl(unsigned, securityKey, expiresAt);
        try {
            return URI.create(signed).toURL();
        } catch (MalformedURLException | IllegalArgumentException ex) {
            throw new IllegalStateException("Invalid Bunny token URL", ex);
        }
    }

    /**
     * Signs {@code url} for Advanced Token Auth (query-string, exact path).
     *
     * @param url         absolute HTTPS object URL (no token params yet)
     * @param securityKey Token Authentication Key
     * @param expiresAt   absolute UNIX expiry (seconds)
     * @return signed URL
     */
    static String signUrl(String url, String securityKey, long expiresAt) {
        return signUrl(url, securityKey, expiresAt, "", false, null);
    }

    /**
     * Full Advanced signer (subset used by Directwerk; directory / geo / IP optional).
     */
    static String signUrl(
            String url,
            String securityKey,
            long expiresAt,
            String userIp,
            boolean isDirectory,
            String pathAllowed
    ) {
        Objects.requireNonNull(url, "url");
        Objects.requireNonNull(securityKey, "securityKey");
        if (securityKey.isBlank()) {
            throw new IllegalArgumentException("securityKey must not be blank");
        }
        if (expiresAt <= 0) {
            throw new IllegalArgumentException("expiresAt must be positive");
        }
        String ip = userIp == null ? "" : userIp;

        try {
            URI uri = URI.create(url);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new IllegalArgumentException("url must be an absolute HTTPS URL");
            }

            TreeMap<String, String> parameters = new TreeMap<>();
            if (pathAllowed != null && !pathAllowed.isEmpty()) {
                parameters.put("token_path", pathAllowed);
            }

            String signaturePath = (pathAllowed != null && !pathAllowed.isEmpty())
                    ? pathAllowed
                    : uri.getPath();
            if (signaturePath == null || signaturePath.isEmpty()) {
                signaturePath = "/";
            }

            String expires = String.valueOf(expiresAt);
            String signingData = joinRaw(parameters);
            String message = signaturePath + expires + signingData + ip;

            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(securityKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
            String token = "HS256-" + Base64.getUrlEncoder().withoutPadding().encodeToString(digest);

            String base = uri.getScheme() + "://" + uri.getHost()
                    + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
            String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
            String encodedParams = joinEncoded(parameters);
            String tail = encodedParams.isEmpty() ? "" : "&" + encodedParams;

            if (isDirectory) {
                return base + "/bcdn_token=" + token + tail + "&expires=" + expires + path;
            }
            return base + path + "?token=" + token + tail + "&expires=" + expires;
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", ex);
        }
    }

    private static String joinRaw(TreeMap<String, String> parameters) {
        StringBuilder signingData = new StringBuilder();
        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            if (signingData.length() > 0) {
                signingData.append('&');
            }
            signingData.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return signingData.toString();
    }

    private static String joinEncoded(TreeMap<String, String> parameters) {
        StringBuilder urlData = new StringBuilder();
        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            if (urlData.length() > 0) {
                urlData.append('&');
            }
            String encodedValue = URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8)
                    .replace("+", "%20");
            urlData.append(entry.getKey()).append('=').append(encodedValue);
        }
        return urlData.toString();
    }

    private static String requireHttpsBase(String privateCdnBaseUrl) {
        String trimmed = privateCdnBaseUrl.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        URI uri = URI.create(trimmed);
        if (!uri.isAbsolute()
                || uri.getHost() == null
                || !"https".equalsIgnoreCase(uri.getScheme())
                || uri.getQuery() != null
                || uri.getRawFragment() != null) {
            throw new IllegalArgumentException("privateCdnBaseUrl must be an absolute HTTPS URI");
        }
        return trimmed;
    }
}
