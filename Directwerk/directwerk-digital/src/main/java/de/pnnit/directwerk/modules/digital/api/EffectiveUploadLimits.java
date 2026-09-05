package de.pnnit.directwerk.modules.digital.api;

/**
 * Effective per-asset-type media upload limits in bytes for one tenant
 * (per-tenant overrides where set, platform defaults otherwise).
 */
public record EffectiveUploadLimits(
        long maxAudioBytes,
        long maxImageBytes,
        long maxVideoBytes,
        long maxDocumentBytes
) {
}
