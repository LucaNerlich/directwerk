package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import de.pnnit.directwerk.modules.digital.entity.AssetStatus;
import de.pnnit.directwerk.modules.digital.entity.AssetType;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedFormatMatcher;
import de.pnnit.directwerk.modules.podcast.service.SubscriberEpisodeService;
import de.pnnit.directwerk.modules.digital.api.EntitlementApi;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubscriberFeedAccessService implements SubscriberFeedAccess {

    private final SubscriberEpisodeService subscriberEpisodeService;
    private final EntitlementApi entitlementApi;

    @Override
    @Transactional(readOnly = true)
    public List<Episode> listEntitledEpisodes(
            Long tenantId,
            Long userId,
            SubscriberFeed feed) {
        return subscriberEpisodeService.listEntitledEpisodes(tenantId, userId).stream()
                .filter(episode -> SubscriberFeedFormatMatcher.includes(feed, episode))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasEpisodeAccess(
            Long tenantId,
            Long userId,
            SubscriberFeed feed,
            Episode episode) {
        return SubscriberFeedFormatMatcher.includes(feed, episode)
                && entitlementApi.hasAccess(tenantId, userId, episode.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasAudioAccess(
            Long tenantId,
            Long userId,
            SubscriberFeed feed,
            Episode episode,
            MediaAsset audioAsset) {
        if (!hasEpisodeAccess(tenantId, userId, feed, episode)) {
            return false;
        }
        MediaAsset asset = audioAsset;
        return asset != null
                && asset.getStatus() == AssetStatus.READY
                && asset.getAssetType() == AssetType.AUDIO;
    }
}
