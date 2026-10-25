package de.pnnit.directwerk.api.dto;

/**
 * One FK-backed content attachment of a media asset.
 *
 * <p>{@code kind} is one of {@code EPISODE_AUDIO}, {@code EPISODE_COVER}, {@code SERIES_COVER},
 * {@code FORMAT_COVER}, {@code ARTICLE_HERO}, {@code DIGITAL_PUBLICATION}, {@code MEDIA_EPISODE_LINK}.
 */
public record MediaAssetReferenceView(
        String kind,
        Long id,
        String title
) {
}
