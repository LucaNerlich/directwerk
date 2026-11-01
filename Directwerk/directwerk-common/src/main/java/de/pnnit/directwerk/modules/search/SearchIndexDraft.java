package de.pnnit.directwerk.modules.search;

/**
 * One published document to upsert into the tenant search index.
 * {@code body} and {@code excerpt} may still contain HTML; the index strips tags.
 */
public record SearchIndexDraft(
        long tenantId,
        String kind,
        long sourceId,
        String title,
        String slug,
        String body,
        String excerpt,
        String hrefPath,
        String access
) {
}
