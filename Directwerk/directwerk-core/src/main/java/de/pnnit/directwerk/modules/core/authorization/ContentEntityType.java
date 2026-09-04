package de.pnnit.directwerk.modules.core.authorization;

/**
 * Content entity types covered by the RBAC permission model (issue #148).
 * Taxonomy, products, subscribers and settings stay tenant-admin-only and are
 * intentionally not part of this enum.
 */
public enum ContentEntityType {
    EPISODE,
    ARTICLE,
    SERIES,
    MEDIA_ASSET,
    MEDIA_FOLDER
}
