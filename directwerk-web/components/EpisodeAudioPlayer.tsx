'use client'

import {Button} from '@directwerk/ui/components/button'

import {PauseGlyph, PlayGlyph} from '@/components/player/PlayerIcons'
import PlayerScrubber from '@/components/player/PlayerScrubber'
import {useAudioPlayer, type PlayerTrack} from '@/lib/player/AudioPlayerContext'
import {useDictionary} from '@/lib/i18n/LocaleProvider'

/**
 * Episode-detail controls that drive the site-wide audio element. Starting
 * playback here keeps audio alive when the listener leaves the detail route.
 */
export default function EpisodeAudioPlayer({
    track,
}: {
    track: PlayerTrack
}): React.JSX.Element {
    const {catalog} = useDictionary()
    const {track: active, isPlaying, currentTime, duration, playTrack, togglePlay, seek} =
        useAudioPlayer()

    const isThisTrack = active?.slug === track.slug
    const showingPlaying = isThisTrack && isPlaying

    function handlePrimary(): void {
        // Pause while playing even if this page's entitled URL rotated
        // (fresh presign vs the loaded src) — do not re-arm Umami mid-play.
        // Same slug paused + rotated URL still reloads via playTrack below.
        if (
            isThisTrack &&
            (isPlaying || active?.audioUrl === track.audioUrl)
        ) {
            togglePlay()
            return
        }
        playTrack(track)
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Button
                    aria-label={
                        showingPlaying ? catalog.playerPause : catalog.playerPlay
                    }
                    className="size-12 shrink-0 rounded-full"
                    onClick={handlePrimary}
                    size="icon-lg"
                    type="button"
                    variant="default"
                >
                    {showingPlaying ? (
                        <PauseGlyph className="size-5" />
                    ) : (
                        <PlayGlyph className="size-5" />
                    )}
                </Button>
                <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {isThisTrack
                        ? showingPlaying
                            ? catalog.playerNowPlaying
                            : catalog.playerPaused
                        : catalog.playerReady}
                </p>
            </div>
            {isThisTrack ? (
                <PlayerScrubber
                    currentTime={currentTime}
                    duration={duration}
                    onSeek={seek}
                    seekLabel={catalog.playerSeek}
                />
            ) : null}
        </div>
    )
}
