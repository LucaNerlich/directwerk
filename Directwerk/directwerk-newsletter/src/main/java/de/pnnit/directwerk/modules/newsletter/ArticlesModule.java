package de.pnnit.directwerk.modules.newsletter;

/**
 * Feature-module key for the Write desk: article drafting and publication.
 *
 * <p>Depends on {@code DIGITAL_CONTENT} in the module catalog. Write operations are guarded with
 * {@code @RequiresModule(ArticlesModule.KEY)}.
 */
public final class ArticlesModule {

    public static final String KEY = "ARTICLES";

    private ArticlesModule() {
    }
}
