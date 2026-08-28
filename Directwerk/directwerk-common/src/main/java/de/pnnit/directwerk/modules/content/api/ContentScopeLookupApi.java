package de.pnnit.directwerk.modules.content.api;

/**
 * Validates ProductAccessRule scope targets exist for the current tenant.
 * App-layer adapter reaches into podcast/digital repositories.
 */
public interface ContentScopeLookupApi {

    void requirePodcastSeries(Long tenantId, Long seriesId);

    void requireFormat(Long tenantId, Long formatId);

    void requireCategory(Long tenantId, Long categoryId);

    void requireDigitalAsset(Long tenantId, Long assetId);
}
