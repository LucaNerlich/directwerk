package de.pnnit.directwerk.modules.core.util;

import java.util.Locale;
import java.util.Objects;

/**
 * Validates S3/object-storage keys are scoped to a tenant slug prefix.
 * Use before generating any signed URL or accepting an upload key.
 */
public final class TenantAssetKeys {

    private TenantAssetKeys() {
    }

    /**
     * Validates and returns an object-storage key scoped to the specified tenant.
     *
     * @param tenantSlug the tenant identifier used as the required key prefix
     * @param objectKey the object-storage key to validate
     * @return the trimmed object key
     * @throws NullPointerException if {@code tenantSlug} or {@code objectKey} is {@code null}
     * @throws IllegalArgumentException if either value is empty, the key contains unsafe path segments,
     *                                  or the key does not use the tenant prefix
     */
    public static String requireTenantPrefix(String tenantSlug, String objectKey) {
        Objects.requireNonNull(tenantSlug, "tenantSlug");
        Objects.requireNonNull(objectKey, "objectKey");
        String slug = tenantSlug.trim().toLowerCase(Locale.ROOT);
        String key = objectKey.trim();
        if (slug.isEmpty() || key.isEmpty()) {
            throw new IllegalArgumentException("Tenant slug and object key are required");
        }
        if (key.contains("..") || key.startsWith("/")) {
            throw new IllegalArgumentException("Invalid object key");
        }
        String expectedPrefix = slug + "/";
        if (!key.toLowerCase(Locale.ROOT).startsWith(expectedPrefix)) {
            throw new IllegalArgumentException(
                    "Object key must be prefixed with tenant slug: " + expectedPrefix
            );
        }
        return key;
    }

    /**
     * Whether {@code objectKey} is one of {@code tenantSlug}'s publicly served keys
     * (grammar: {@code {tenantSlug}/public/...}). Single home of that decision — CDN URL
     * resolution, RSS eligibility and delete-time purge decisions all delegate here so the
     * predicate cannot drift between call sites.
     */
    public static boolean isPublicKey(String tenantSlug, String objectKey) {
        if (tenantSlug == null || objectKey == null) {
            return false;
        }
        String slug = tenantSlug.trim().toLowerCase(Locale.ROOT);
        String key = objectKey.trim();
        if (slug.isEmpty() || key.isEmpty()) {
            return false;
        }
        if (key.startsWith("/")) {
            key = key.substring(1);
        }
        return key.toLowerCase(Locale.ROOT).startsWith(slug + "/public/");
    }

    /**
     * Constructs a tenant-scoped key for a public asset.
     *
     * @param tenantSlug    the tenant identifier
     * @param relativePath  the asset path relative to the public directory
     * @return the validated public asset key
     */
    public static String publicKey(String tenantSlug, String relativePath) {
        return build(tenantSlug, "public", relativePath);
    }

    /**
     * Constructs a tenant-scoped key for a private asset.
     *
     * @param tenantSlug    the tenant identifier
     * @param relativePath  the asset path within the private namespace
     * @return the validated private asset key
     */
    public static String privateKey(String tenantSlug, String relativePath) {
        return build(tenantSlug, "private", relativePath);
    }

    /**
     * Constructs a tenant-scoped key for a staging asset.
     *
     * @param tenantSlug    the tenant identifier
     * @param relativePath  the asset path relative to the staging directory
     * @return the validated staging asset key
     */
    public static String stagingKey(String tenantSlug, String relativePath) {
        return build(tenantSlug, "staging", relativePath);
    }

    /**
     * Builds a tenant-scoped object-storage key for the specified visibility.
     *
     * @param tenantSlug    the tenant identifier
     * @param visibility    the key's visibility segment
     * @param relativePath  the path within the visibility segment
     * @return the validated tenant-scoped object-storage key
     * @throws NullPointerException     if {@code relativePath} is {@code null}
     * @throws IllegalArgumentException if {@code relativePath} starts with {@code "/"} or contains {@code ".."}
     */
    private static String build(String tenantSlug, String visibility, String relativePath) {
        Objects.requireNonNull(relativePath, "relativePath");
        String relative = relativePath.trim();
        if (relative.startsWith("/") || relative.contains("..")) {
            throw new IllegalArgumentException("Invalid relative path");
        }
        String key = tenantSlug.trim().toLowerCase(Locale.ROOT) + "/" + visibility + "/" + relative;
        return requireTenantPrefix(tenantSlug, key);
    }
}
