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
}
