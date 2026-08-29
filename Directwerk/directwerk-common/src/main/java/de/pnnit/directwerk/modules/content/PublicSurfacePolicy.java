package de.pnnit.directwerk.modules.content;

/**
 * Single module for what paid vs free content may expose on public HTTP and RSS surfaces.
 * MediaAsset CDN eligibility remains in {@code PublicAssetPolicy} (digital module).
 */
public final class PublicSurfacePolicy {

    private static final String FREE_ACCESS = "FREE";

    private PublicSurfacePolicy() {
    }

    public static boolean isFreeAccess(String accessPolicy) {
        return FREE_ACCESS.equals(accessPolicy);
    }

    public static boolean exposesFullContent(String accessPolicy) {
        return isFreeAccess(accessPolicy);
    }

    public static String articleBody(String body, String accessPolicy) {
        return exposesFullContent(accessPolicy) ? body : null;
    }

    public static boolean includesInPublicRss(String accessPolicy) {
        return isFreeAccess(accessPolicy);
    }
}
