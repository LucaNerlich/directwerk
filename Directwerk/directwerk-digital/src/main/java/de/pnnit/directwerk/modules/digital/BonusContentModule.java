package de.pnnit.directwerk.modules.digital;

/**
 * Feature-module key for distributing bonus digital assets to entitled subscribers
 * (level/product-gated downloads), independent of podcast or article content.
 *
 * <p>Depends on {@code DIGITAL_CONTENT} in the module catalog. Guards
 * {@code SubscriberPortalAccessService.listDownloads} and its controller.
 */
public final class BonusContentModule {

    public static final String KEY = "BONUS_CONTENT";

    private BonusContentModule() {
    }
}
