package de.pnnit.directwerk.modules.podcast.service;

import de.pnnit.directwerk.modules.podcast.entity.Episode;
import de.pnnit.directwerk.modules.podcast.entity.EpisodeStatus;
import de.pnnit.directwerk.modules.search.SearchIndex;
import de.pnnit.directwerk.modules.search.SearchIndexDraft;
import de.pnnit.directwerk.modules.search.SearchKinds;

final class EpisodeSearchIndex {

    private EpisodeSearchIndex() {
    }

    static void mirror(SearchIndex index, Episode episode) {
        if (episode.getId() == null || episode.getTenant() == null || episode.getTenant().getId() == null) {
            return;
        }
        long tenantId = episode.getTenant().getId();
        if (episode.getStatus() == EpisodeStatus.PUBLISHED) {
            index.sync(new SearchIndexDraft(
                    tenantId,
                    SearchKinds.EPISODE,
                    episode.getId(),
                    episode.getTitle(),
                    episode.getSlug(),
                    episode.getDescription(),
                    null,
                    "/episodes/" + episode.getSlug(),
                    episode.getAccessPolicy().name()
            ));
            return;
        }
        index.remove(tenantId, SearchKinds.EPISODE, episode.getId());
    }

    static void remove(SearchIndex index, long tenantId, long episodeId) {
        index.remove(tenantId, SearchKinds.EPISODE, episodeId);
    }
}
