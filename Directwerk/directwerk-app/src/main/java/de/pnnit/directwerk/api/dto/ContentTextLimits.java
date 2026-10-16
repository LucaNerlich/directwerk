package de.pnnit.directwerk.api.dto;

/**
 * Shared ceilings for free-text content fields (#562).
 *
 * <p>These started as private constants inside {@code ArticleController}, so no sibling request
 * DTO could reuse them: the article import path and the episode/series/format description fields
 * persisted the same {@code text} columns without any bound, leaving Jackson's 100 MB default as
 * the only ceiling.</p>
 */
public final class ContentTextLimits {

    /** Rich-text body of an article (editor- or import-supplied). */
    public static final int BODY_MAX = 100_000;

    /** Short summary shown in lists and feeds. */
    public static final int EXCERPT_MAX = 2_000;

    /** Episode / series / format description (rich text, stored as {@code text}). */
    public static final int DESCRIPTION_MAX = 100_000;

    private ContentTextLimits() {
    }
}
