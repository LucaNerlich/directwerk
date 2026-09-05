package de.pnnit.directwerk.modules.core.service;

/**
 * Per-tenant media upload size overrides in bytes. A {@code null} component means
 * "platform default" and resets any previous override; a non-null component must
 * lie within {@link #MIN_BYTES}..{@link #MAX_BYTES} (the upper bound is S3's
 * single-PUT object ceiling, which is also what presigned browser uploads use).
 */
public record TenantUploadLimits(
        Long maxAudioBytes,
        Long maxImageBytes,
        Long maxVideoBytes,
        Long maxDocumentBytes
) {

    /** Smallest accepted override — anything smaller is a certain misconfiguration. */
    public static final long MIN_BYTES = 1L;

    /** Largest accepted override — S3 single-PUT ceiling for presigned uploads. */
    public static final long MAX_BYTES = 5L * 1024 * 1024 * 1024;

    public TenantUploadLimits {
        validate("maxAudioBytes", maxAudioBytes);
        validate("maxImageBytes", maxImageBytes);
        validate("maxVideoBytes", maxVideoBytes);
        validate("maxDocumentBytes", maxDocumentBytes);
    }

    private static void validate(String field, Long value) {
        if (value == null) {
            return;
        }
        if (value < MIN_BYTES || value > MAX_BYTES) {
            throw new IllegalArgumentException(
                    field + " must be between " + MIN_BYTES + " and " + MAX_BYTES + " bytes");
        }
    }
}
