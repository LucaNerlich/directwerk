'use client'

import {Button} from '@directwerk/ui/components/button'
import type {PublicEpisode} from '@directwerk/api/types'

import {
    useAudioPlayer,
    type PlayerTrack,
} from '@/lib/player/AudioPlayerContext'
import {playerTrackFromEpisode} from '@/lib/player/playerTrack'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Catalog “Listen” CTA that starts the site-wide player (and Umami
 * `episode-play`) instead of only navigating to the detail page. When this
 * episode is already loaded, toggles pause/resume without a second play event.
 */
export default function EpisodeListenButton({
    episode,
    size = 'default',
    variant = 'default',
}: {
    episode: PublicEpisode
    size?: 'default' | 'sm'
    variant?: 'default' | 'outline'
}): React.JSX.Element | null {
    const lang = useLocale()
    const href = localizedPath(
        lang,
        `/episodes/${encodeURIComponent(episode.slug)}`,
    )
    const playableTrack = playerTrackFromEpisode(episode, href)
    if (playableTrack === null) {
        return null
    }
    return (
        <EpisodeListenButtonReady
            size={size}
            track={playableTrack}
            variant={variant}
        />
    )
}

function EpisodeListenButtonReady({
    track,
    size,
    variant,
}: {
    track: PlayerTrack
    size: 'default' | 'sm'
    variant: 'default' | 'outline'
}): React.JSX.Element {
    const {common, catalog} = useDictionary()
    const {track: active, isPlaying, playTrack, togglePlay} = useAudioPlayer()

    const isThisTrack = active?.slug === track.slug
    const showingPlaying = isThisTrack && isPlaying

    return (
        <Button
            aria-label={
                showingPlaying ? catalog.playerPause : catalog.playerPlay
            }
            onClick={() => {
                if (isThisTrack && active?.audioUrl === track.audioUrl) {
                    togglePlay()
                    return
                }
                playTrack(track)
            }}
            size={size}
            type="button"
            variant={variant}
        >
            {showingPlaying ? catalog.playerPause : common.listen}
        </Button>
    )
}
