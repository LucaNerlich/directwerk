package de.pnnit.directwerk.modules.digital.importing;

/**
 * The one ceiling for imported rich text, shared by both entry paths (#637).
 *
 * <p>These started as request-DTO validation in the app module (#562), which left the RSS bulk
 * import — reaching {@code ArticleImportService} directly, without binding a DTO — bounded only by
 * the 5 MB feed itself. The numbers live here so the DTOs and the import path cannot disagree.</p>
 */
public final class ImportedTextLimits {

    /** Rich-text body of an imported article. */
    public static final int BODY_MAX = 100_000;

    /** Short summary of an imported article. */
    public static final int EXCERPT_MAX = 2_000;

    private ImportedTextLimits() {
    }
}
