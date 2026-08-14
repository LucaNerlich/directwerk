package de.pnnit.directwerk.modules.subscription.util;

import de.pnnit.directwerk.modules.core.util.SlugNormalizer;

public final class ProductSlug {

    private ProductSlug() {
    }

    public static String normalize(String rawSlug) {
        return SlugNormalizer.normalize(rawSlug);
    }
}
