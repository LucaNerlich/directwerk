package de.pnnit.directwerk.modules.digital.api;

import de.pnnit.directwerk.modules.digital.entity.MediaAsset;
import java.net.URL;
import java.util.Optional;

public interface EpisodeMediaApi {

    MediaAsset requireReadyAudio(Long assetId);

    void attachEpisode(Long assetId, Long episodeId);

    MediaAsset promoteToPublic(Long assetId);

    MediaAsset demoteToPrivate(Long assetId);

    Optional<URL> publicCdnUrl(MediaAsset asset);
}
