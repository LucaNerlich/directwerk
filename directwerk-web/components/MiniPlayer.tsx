'use client'

import Image from 'next/image'
import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'

import {CloseGlyph, PauseGlyph, PlayGlyph} from '@/components/player/PlayerIcons'
import PlayerScrubber from '@/components/player/PlayerScrubber'
import {useAudioPlayer} from '@/lib/player/AudioPlayerContext'
import {useDictionary} from '@/lib/i18n/LocaleProvider'

/**
 * Fixed site-wide bar so audio keeps playing across App Router navigations.
 * Renders nothing until a track is loaded; dismiss clears the session player.
 */
export default function MiniPlayer(): React.JSX.Element | null {
    const {catalog} = useDictionary()
    const {track, isPlaying, currentTime, duration, togglePlay, seek, dismiss} =
        useAudioPlayer()

    if (track === null) {
        return null
    }

    const coverOk =
        track.coverImageUrl !== null && isAllowedFeedUrl(track.coverImageUrl)

    return (
        <div
            aria-label={catalog.miniPlayerLabel}
            className="dw-mini-player fixed inset-x-0 bottom-0 z-50 border-t px-3 py-2.5 sm:px-4"
            data-dw-mini-player=""
            role="region"
        >
            <div className="mx-auto flex max-w-6xl items-center gap-3">
                {coverOk ? (
                    <Image
                        alt=""
                        className="size-11 shrink-0 rounded-md object-cover"
                        height={44}
                        src={track.coverImageUrl!}
                        width={44}
                    />
                ) : (
                    <div
                        aria-hidden="true"
                        className="size-11 shrink-0 rounded-md bg-[color-mix(in_oklab,var(--primary)_22%,var(--muted))]"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <Link
                        className="block truncate text-sm font-medium text-[color:var(--dw-brand-ink,var(--foreground))] hover:underline"
                        href={track.href}
                    >
                        {track.title}
                    </Link>
                    <PlayerScrubber
                        currentTime={currentTime}
                        duration={duration}
                        onSeek={seek}
                        seekLabel={catalog.playerSeek}
                    />
                </div>
                <Button
                    aria-label={isPlaying ? catalog.playerPause : catalog.playerPlay}
                    className="size-11 shrink-0 rounded-full"
                    onClick={togglePlay}
                    size="icon-lg"
                    type="button"
                    variant="default"
                >
                    {isPlaying ? (
                        <PauseGlyph className="size-5" />
                    ) : (
                        <PlayGlyph className="size-5" />
                    )}
                </Button>
                <Button
                    aria-label={catalog.playerDismiss}
                    className="size-10 shrink-0"
                    onClick={dismiss}
                    size="icon"
                    type="button"
                    variant="ghost"
                >
                    <CloseGlyph className="size-4" />
                </Button>
            </div>
        </div>
    )
}
