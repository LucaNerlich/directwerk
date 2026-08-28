package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import java.util.List;

/**
 * Deep module: what episodes and assets a subscriber may see on a given feed.
 * RSS snapshot, enclosure redirect, portal listing, and presign adapters call here.
 */
public interface SubscriberFeedAccess {

    List<Episode> listEntitledEpisodes(
            Long tenantId,
            Long userId,
            SubscriberFeed feed);

    boolean hasEpisodeAccess(
            Long tenantId,
            Long userId,
            SubscriberFeed feed,
            Episode episode);

    boolean hasAudioAccess(
            Long tenantId,
            Long userId,
            SubscriberFeed feed,
            Episode episode,
            MediaAsset audioAsset);
}
