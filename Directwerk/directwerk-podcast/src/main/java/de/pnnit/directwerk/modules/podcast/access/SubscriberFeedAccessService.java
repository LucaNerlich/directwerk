package de.pnnit.directwerk.modules.podcast.access;

import de.pnnit.directwerk.modules.digital.access.AbstractFeedAccessService;
import de.pnnit.directwerk.modules.podcast.api.EpisodeAccessApi;
import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeed;
import de.pnnit.directwerk.modules.podcast.feed.SubscriberFeedFormatMatcher;
import de.pnnit.directwerk.modules.podcast.service.SubscriberEpisodeService;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SubscriberFeedAccessService
        extends AbstractFeedAccessService<Episode, SubscriberFeed>
        implements SubscriberFeedAccess {

    private final SubscriberEpisodeService subscriberEpisodeService;
    private final EpisodeAccessApi episodeAccessApi;

    @Override
    @Transactional(readOnly = true)
    public List<Episode> listEntitledEpisodes(
            Long tenantId,
            Long userId,
            SubscriberFeed feed) {
        return listEntitled(tenantId, userId, feed);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Episode> listEntitledEpisodesForFormats(
            Long tenantId,
            Long userId,
            Set<Long> activeFormatIds) {
        return listEntitledForSelection(tenantId, userId, activeFormatIds);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasEpisodeAccess(
            Long tenantId,
            Long userId,
            SubscriberFeed feed,
            Episode episode) {
        return hasAccess(tenantId, userId, feed, episode);
    }

    @Override
    protected List<Episode> entitledContent(Long tenantId, Long userId) {
        return subscriberEpisodeService.listEntitledEpisodes(tenantId, userId);
    }

    @Override
    protected boolean matchesFeed(SubscriberFeed feed, Episode episode) {
        return SubscriberFeedFormatMatcher.includes(feed, episode);
    }

    @Override
    protected boolean matchesSelection(Episode episode, Set<Long> selectionIds) {
        return SubscriberFeedFormatMatcher.episodeMatchesSelectedFormats(episode, selectionIds);
    }

    @Override
    protected boolean hasContentAccess(Long tenantId, Long userId, Episode episode) {
        return episodeAccessApi.hasAccess(tenantId, userId, episode.getId());
    }
}
