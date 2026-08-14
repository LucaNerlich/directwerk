package de.pnnit.directwerk.modules.digital.service;

import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.digital.exception.UploadValidationException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Mime/size allow-lists and filename sanitization for media uploads.
 */
public final class MediaUploadRules {

    private static final Pattern UNSAFE_FILENAME = Pattern.compile("[^a-zA-Z0-9._-]+");
    private static final long MB = 1024L * 1024L;

    private static final Map<AssetType, Set<String>> ALLOWED_MIME = Map.of(
            AssetType.AUDIO, Set.of("audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/ogg", "audio/webm"),
            AssetType.IMAGE, Set.of("image/jpeg", "image/png", "image/webp", "image/gif"),
            AssetType.VIDEO, Set.of("video/mp4", "video/webm"),
            AssetType.DOCUMENT, Set.of("application/pdf")
    );

    private static final Map<AssetType, Long> MAX_BYTES = Map.of(
            AssetType.AUDIO, 500L * MB,
            AssetType.IMAGE, 10L * MB,
            AssetType.VIDEO, 1024L * MB,
            AssetType.DOCUMENT, 50L * MB
    );

    private MediaUploadRules() {
    }

    public static void validateMimeAndSize(AssetType assetType, String mimeType, long sizeBytes) {
        if (mimeType == null || mimeType.isBlank()) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "mimeType is required");
        }
        String normalized = mimeType.trim().toLowerCase(Locale.ROOT);
        Set<String> allowed = ALLOWED_MIME.get(assetType);
        if (allowed == null || !allowed.contains(normalized)) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "mimeType not allowed for assetType " + assetType + ": " + mimeType
            );
        }
        Long max = MAX_BYTES.get(assetType);
        if (max == null) {
            throw new UploadValidationException(
                    "UPLOAD_VALIDATION_FAILED",
                    "No size limit configured for assetType " + assetType
            );
        }
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
        if (cleaned.isBlank() || cleaned.length() > 180) {
            throw new UploadValidationException("UPLOAD_VALIDATION_FAILED", "filename is invalid");
        }
        return cleaned;
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
}
