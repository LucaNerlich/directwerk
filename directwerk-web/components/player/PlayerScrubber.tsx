'use client'

import {formatPlaybackClock} from '@/lib/player/formatPlaybackClock'

/**
 * Seekable progress control shared by the episode detail player and the
 * site-wide mini-player.
 */
export default function PlayerScrubber({
    currentTime,
    duration,
    onSeek,
    seekLabel,
}: {
    currentTime: number
    duration: number
    onSeek: (seconds: number) => void
    seekLabel: string
}): React.JSX.Element {
    const max = duration > 0 ? duration : 0
    const value = max > 0 ? Math.min(currentTime, max) : 0
    const percent = max > 0 ? (value / max) * 100 : 0

    return (
        <div className="flex w-full min-w-0 items-center gap-2">
            <span className="w-10 shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatPlaybackClock(value)}
            </span>
            <input
                aria-label={seekLabel}
                aria-valuemax={Math.round(max)}
                aria-valuemin={0}
                aria-valuenow={Math.round(value)}
                className="dw-player-scrubber min-w-0 flex-1"
                max={max > 0 ? max : 1}
                min={0}
                onChange={(event) => {
                    onSeek(Number(event.currentTarget.value))
                }}
                step={0.1}
                style={{'--dw-scrub-pct': `${percent}%`} as React.CSSProperties}
                type="range"
                value={value}
            />
            <span className="w-10 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                {formatPlaybackClock(max)}
            </span>
        </div>
    )
}
