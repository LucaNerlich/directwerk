package de.pnnit.directwerk.modules.podcast.api;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import java.util.List;

/**
 * Subscriber-side episode access decisions for the podcast module.
 * The app wires LEVEL/PACKAGE evaluation through its subscription adapter; batch evaluation
 * exists so feed refresh and library listing do not re-fetch subscriptions per episode.
 */
public interface EpisodeAccessApi {

    /**
     * Returns the subset of {@code episodes} the user may access: FREE episodes always,
     * paid episodes according to active LEVEL/PACKAGE entitlements. Order is preserved.
     */
    List<Episode> filterAccessible(Long tenantId, Long userId, List<Episode> episodes);
}
