package de.pnnit.directwerk.modules.digital.api;

/**
 * Tenant-scoped episode existence check, implemented by the content module that
 * owns episodes (podcast). Lets upload flows validate {@code episodeId} links
 * without a hard module dependency — injected as an optional provider and
 * fail-closed when no implementation is present.
 */
public interface EpisodeLinkValidator {

    /**
     * @param tenantId the tenant from the current request context
     * @param episodeId the episode to link
     * @return {@code true} when the episode exists in the given tenant
     */
    boolean episodeExists(Long tenantId, Long episodeId);

    /**
     * @param tenantId the tenant from the current request context
     * @param episodeId the episode recorded as the asset's current owner
     * @param audioAssetId the asset about to be re-linked
     * @return {@code true} while that episode still points at the asset. Implementations that
     * cannot answer keep the conservative one-asset guard.
     */
    default boolean episodeReferencesAudioAsset(Long tenantId, Long episodeId, Long audioAssetId) {
        return true;
    }
}
