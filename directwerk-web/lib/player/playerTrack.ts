import type {PublicEpisode} from '@directwerk/api/types'

import type {PlayerTrack} from '@/lib/player/AudioPlayerContext'

/**
 * Builds a site-player track from a public/entitled catalog episode.
 * Returns null when there is no playable CDN URL (locked or missing audio).
 */
export function playerTrackFromEpisode(
    episode: Pick<
        PublicEpisode,
        | 'id'
        | 'slug'
        | 'title'
        | 'episodeNumber'
        | 'audioCdnUrl'
        | 'coverImageUrl'
        | 'seriesSlug'
    >,
    href: string,
): PlayerTrack | null {
    if (episode.audioCdnUrl === null || episode.audioCdnUrl.length === 0) {
        return null
    }
    const title =
        episode.episodeNumber !== null
            ? `#${episode.episodeNumber} ${episode.title}`
            : episode.title
    return {
        id: episode.id,
        slug: episode.slug,
        title,
        episodeTitle: episode.title,
        audioUrl: episode.audioCdnUrl,
        coverImageUrl: episode.coverImageUrl,
        href,
        seriesSlug: episode.seriesSlug,
    }
}
