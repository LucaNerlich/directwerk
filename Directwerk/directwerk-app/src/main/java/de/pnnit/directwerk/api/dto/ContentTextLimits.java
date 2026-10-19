package de.pnnit.directwerk.api.dto;

import de.pnnit.directwerk.modules.digital.importing.ImportedTextLimits;

/**
 * Shared ceilings for free-text content fields (#562).
 *
 * <p>These started as private constants inside {@code ArticleController}, so no sibling request
 * DTO could reuse them: the article import path and the episode/series/format description fields
 * persisted the same {@code text} columns without any bound, leaving Jackson's 100 MB default as
 * the only ceiling.</p>
 */
public final class ContentTextLimits {

    /** Rich-text body of an article (editor- or import-supplied). Shared with the import path. */
    public static final int BODY_MAX = ImportedTextLimits.BODY_MAX;

    /** Short summary shown in lists and feeds. Shared with the import path. */
    public static final int EXCERPT_MAX = ImportedTextLimits.EXCERPT_MAX;

    /** Episode / series / format description (rich text, stored as {@code text}). */
    public static final int DESCRIPTION_MAX = 100_000;

    private ContentTextLimits() {
    }
}
