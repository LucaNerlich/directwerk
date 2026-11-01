package de.pnnit.directwerk.api.dto;

/**
 * One row of {@code GET /api/v1/public/search-documents}.
 * {@code plainText} is the stripped body when the caller can open it.
 * Locked paid rows leave it empty; the public teaser stays in {@code excerpt}.
 */
public record PublicSearchDocumentView(
        String kind,
        String title,
        String slug,
        String excerpt,
        String plainText,
        String hrefPath,
        String access
) {
}
