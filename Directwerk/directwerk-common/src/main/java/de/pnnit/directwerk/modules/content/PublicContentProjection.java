package de.pnnit.directwerk.modules.content;

/**
 * @deprecated Use {@link PublicSurfacePolicy} — retained for migration compatibility.
 */
@Deprecated
public final class PublicContentProjection {

    private PublicContentProjection() {
    }

    public static boolean exposesFullContent(String accessPolicy) {
        return PublicSurfacePolicy.exposesFullContent(accessPolicy);
    }

    public static String articleBody(String body, String accessPolicy) {
        return PublicSurfacePolicy.articleBody(body, accessPolicy);
    }

    public static boolean includesInPublicRss(String accessPolicy) {
        return PublicSurfacePolicy.includesInPublicRss(accessPolicy);
    }
}
