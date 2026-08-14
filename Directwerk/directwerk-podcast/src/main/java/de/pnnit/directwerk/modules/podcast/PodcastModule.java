package de.pnnit.directwerk.modules.podcast;

/**
 * Feature-module key for podcast series, episodes, and taxonomy.
 *
 * <p>Depends on {@code DIGITAL_CONTENT} in the module catalog. Write operations are guarded with
 * {@code @RequiresModule(PodcastModule.KEY)}.
 */
public final class PodcastModule {

    public static final String KEY = "PODCAST";

    private PodcastModule() {
    }
}
