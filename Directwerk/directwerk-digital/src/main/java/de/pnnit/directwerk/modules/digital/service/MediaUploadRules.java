package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import de.pnnit.directwerk.modules.core.entity.Tenant;
import de.pnnit.directwerk.modules.core.service.TenantUploadLimits;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Mime/size allow-lists and filename sanitization for media uploads.
 */
public final class MediaUploadRules {

    private static final Pattern UNSAFE_FILENAME = Pattern.compile("[^a-zA-Z0-9._-]+");
    private static final int MAX_FILENAME_STEM_LENGTH = 100;
    private static final long MB = 1024L * 1024L;

    private static final Map<AssetType, Set<String>> ALLOWED_MIME = Map.of(
            AssetType.AUDIO, Set.of("audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/ogg", "audio/webm"),
            AssetType.IMAGE, Set.of("image/jpeg", "image/png", "image/webp", "image/gif"),
            AssetType.VIDEO, Set.of("video/mp4", "video/webm"),
            AssetType.DOCUMENT, Set.of("application/pdf")
    );

    private static final Map<AssetType, Long> MAX_BYTES = Map.of(
            AssetType.AUDIO, 5L * 1024 * MB,
            AssetType.IMAGE, 10L * MB,
            AssetType.VIDEO, 5L * 1024 * MB,
            AssetType.DOCUMENT, 50L * MB
    );

    /**
     * Upper bound for per-tenant overrides — S3's single-PUT object ceiling, which is
     * also what presigned browser uploads use. Mirrors
     * {@code TenantUploadLimits.MAX_BYTES}.
     */
    public static final long MAX_OVERRIDE_BYTES = TenantUploadLimits.MAX_BYTES;

    private MediaUploadRules() {
    }

    /**
     * Gets the maximum permitted upload size for an asset type.
     *
     * @param assetType the type of asset whose size limit is requested
     * @return the maximum size in bytes
     * @throws UploadValidationException if no size limit is configured for the asset type
     */
    public static long maxBytes(AssetType assetType) {
        Long max = MAX_BYTES.get(assetType);
        if (max == null) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "No size limit configured for assetType " + assetType
            );
        }
        return max;
    }

    /**
     * Resolves the tenant's configured override for an asset type, or {@code null}
     * for the platform default.
     *
     * @param tenant    the tenant whose overrides apply (may be {@code null})
     * @param assetType the asset category
     * @return the override in bytes, or {@code null} when the platform default applies
     */
    public static Long limitOverride(Tenant tenant, AssetType assetType) {
        if (tenant == null || assetType == null) {
            return null;
        }
        return switch (assetType) {
            case AUDIO -> tenant.getMaxAudioBytes();
            case IMAGE -> tenant.getMaxImageBytes();
            case VIDEO -> tenant.getMaxVideoBytes();
            case DOCUMENT -> tenant.getMaxDocumentBytes();
        };
    }

    /**
     * Gets the effective maximum upload size for an asset type: the tenant override
     * when set, otherwise the platform default.
     *
     * @param assetType     the type of asset whose size limit is requested
     * @param overrideBytes the tenant override in bytes, or {@code null} for the default
     * @return the effective maximum size in bytes
     * @throws UploadValidationException if no size limit is configured, or the override
     *                                   is out of range
     */
    public static long effectiveMaxBytes(AssetType assetType, Long overrideBytes) {
        if (overrideBytes != null) {
            if (overrideBytes < TenantUploadLimits.MIN_BYTES || overrideBytes > MAX_OVERRIDE_BYTES) {
                throw new UploadValidationException(
                        "UPLOAD_VALIDATION_FAILED",
                        "Upload limit override out of range for assetType " + assetType
                );
            }
            return overrideBytes;
        }
        return maxBytes(assetType);
    }

    /**
     * Determines whether a MIME type is allowed for an asset type.
     *
     * @param assetType the asset type whose allowed MIME types are checked
     * @param mimeType  the MIME type to evaluate
     * @return {@code true} if the MIME type is allowed for the asset type, {@code false} otherwise
     */
    public static boolean isAllowedMime(AssetType assetType, String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return false;
        }
        Set<String> allowed = ALLOWED_MIME.get(assetType);
        return allowed != null && allowed.contains(normalizeMime(mimeType));
    }

    /**
     * Normalizes a MIME type for consistent comparison.
     *
     * @param mimeType the MIME type to normalize
     * @return the trimmed, lowercase MIME type without parameters, with common aliases converted to canonical values
     */
    public static String normalizeMime(String mimeType) {
        String normalized = mimeType.trim().toLowerCase(Locale.ROOT);
        int semicolon = normalized.indexOf(';');
        if (semicolon >= 0) {
            normalized = normalized.substring(0, semicolon).trim();
        }
        return switch (normalized) {
            case "audio/mp3" -> "audio/mpeg";
            case "image/jpg" -> "image/jpeg";
            default -> normalized;
        };
    }

    /**
     * Determines the MIME type supported for a filename and asset type.
     *
     * @param assetType the type of asset associated with the filename
     * @param filename  the filename whose extension determines the MIME type
     * @return the inferred MIME type, or {@code null} if the extension is unsupported
     */
    public static String inferMimeFromFilename(AssetType assetType, String filename) {
        String ext = fileExtension(filename == null ? "" : filename);
        return switch (assetType) {
            case AUDIO -> switch (ext) {
                case "mp3" -> "audio/mpeg";
                case "m4a" -> "audio/x-m4a";
                case "mp4" -> "audio/mp4";
                case "wav" -> "audio/wav";
                case "ogg" -> "audio/ogg";
                case "webm" -> "audio/webm";
                default -> null;
            };
            case IMAGE -> switch (ext) {
                case "jpg", "jpeg" -> "image/jpeg";
                case "png" -> "image/png";
                case "webp" -> "image/webp";
                case "gif" -> "image/gif";
                default -> null;
            };
            case VIDEO -> switch (ext) {
                case "mp4" -> "video/mp4";
                case "webm" -> "video/webm";
                default -> null;
            };
            case DOCUMENT -> "pdf".equals(ext) ? "application/pdf" : null;
        };
    }

    /**
     * Validates the MIME type and size of an uploaded asset.
     *
     * @param assetType the asset category used to determine allowed MIME types and maximum size
     * @param mimeType the asset's MIME type
     * @param sizeBytes the asset size in bytes
     * @throws UploadValidationException if the MIME type is missing or unsupported, no size limit is configured, or the size is not within the allowed range
     */
    public static void validateMimeAndSize(AssetType assetType, String mimeType, long sizeBytes) {
        validateMimeAndSize(assetType, mimeType, sizeBytes, null);
    }

    /**
     * Validates the MIME type and size of an uploaded asset against the tenant's
     * effective limit (override or platform default).
     *
     * @param assetType     the asset category used to determine allowed MIME types and maximum size
     * @param mimeType      the asset's MIME type
     * @param sizeBytes     the asset size in bytes
     * @param overrideBytes the tenant override in bytes, or {@code null} for the platform default
     * @throws UploadValidationException if the MIME type is missing or unsupported, no size limit is configured, or the size is not within the allowed range
     */
    public static void validateMimeAndSize(AssetType assetType, String mimeType, long sizeBytes, Long overrideBytes) {
        if (mimeType == null || mimeType.isBlank()) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "mimeType is required");
        }
        String normalized = normalizeMime(mimeType);
        Set<String> allowed = ALLOWED_MIME.get(assetType);
        if (allowed == null || !allowed.contains(normalized)) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "mimeType not allowed for assetType " + assetType + ": " + mimeType
            );
        }
        long max = effectiveMaxBytes(assetType, overrideBytes);
        if (sizeBytes <= 0 || sizeBytes > max) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "sizeBytes out of range for assetType " + assetType + " (max " + max + ")"
            );
        }
    }

    public static String sanitizeFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "filename is required");
        }
        String base = filename.trim().replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) {
            base = base.substring(slash + 1);
        }
        if (base.isBlank() || base.contains("..")) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "filename is invalid");
        }
        String cleaned = UNSAFE_FILENAME.matcher(base).replaceAll("_");
        if (cleaned.isBlank() || cleaned.equals(".") || cleaned.equals("..") || cleaned.length() > 180) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "filename is invalid");
        }
        return cleaned;
    }

    /**
     * Sanitizes the filename and returns only its stem (without the extension), capped to
     * {@value #MAX_FILENAME_STEM_LENGTH} characters so the final object key stays URL-safe and
     * well under the 512-byte {@code s3_key} column and S3's 1024-byte key limit.
     */
    public static String sanitizeFilenameStem(String filename) {
        String sanitized = sanitizeFilename(filename);
        int dot = sanitized.lastIndexOf('.');
        String stem = dot > 0 ? sanitized.substring(0, dot) : sanitized;
        if (stem.length() > MAX_FILENAME_STEM_LENGTH) {
            stem = stem.substring(0, MAX_FILENAME_STEM_LENGTH);
        }
        return stem;
    }

    public static String typeFolder(AssetType assetType) {
        return switch (assetType) {
            case AUDIO -> "audio";
            case IMAGE -> "images";
            case VIDEO -> "videos";
            case DOCUMENT -> "documents";
        };
    }

    public static String fileExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot <= 0 || dot == filename.length() - 1) {
            return "bin";
        }
        String ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        return UNSAFE_FILENAME.matcher(ext).replaceAll("");
    }

    /**
     * Maps an allowed MIME type to its canonical file extension, used when an imported asset's
     * filename carries no usable extension (the generic {@code bin} fallback).
     *
     * @param mimeType the normalized MIME type
     * @return the canonical extension, or {@code null} when the MIME type is unknown
     */
    public static String extensionForMime(String mimeType) {
        if (mimeType == null || mimeType.isBlank()) {
            return null;
        }
        return switch (normalizeMime(mimeType)) {
            case "audio/mpeg" -> "mp3";
            case "audio/mp4", "audio/x-m4a" -> "m4a";
            case "audio/wav" -> "wav";
            case "audio/ogg" -> "ogg";
            case "audio/webm" -> "webm";
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            case "video/mp4" -> "mp4";
            case "video/webm" -> "webm";
            case "application/pdf" -> "pdf";
            default -> null;
        };
    }

    /**
     * Provides the default file extension for an asset type, used when an upload or import
     * filename carries no usable extension (the generic {@code bin} fallback) and no
     * MIME-derived extension is known yet.
     *
     * @param assetType the type of asset whose default extension is requested
     * @return the canonical default extension for the asset type
     */
    public static String defaultExtensionForType(AssetType assetType) {
        return switch (assetType) {
            case AUDIO -> "mp3";
            case IMAGE -> "jpg";
            case VIDEO -> "mp4";
            case DOCUMENT -> "pdf";
        };
    }

    /**
     * Ensures a filename carries a usable extension, replacing the generic {@code bin} fallback
     * with the default extension for the asset type. Used at ingest/prepare time when a filename
     * hint or remote URL's last path segment has no extension (e.g. {@code download}), so the
     * persisted filename and the final S3 key never end in {@code bin}.
     *
     * @param filename  the sanitized filename to check
     * @param assetType the type of asset the filename belongs to
     * @return the filename unchanged when it already carries a usable extension, otherwise the
     *         sanitized stem extended with the asset type's default extension
     */
    public static String ensureUsableExtension(String filename, AssetType assetType) {
        if (!"bin".equals(fileExtension(filename))) {
            return filename;
        }
        return sanitizeFilenameStem(filename) + "." + defaultExtensionForType(assetType);
    }
}
