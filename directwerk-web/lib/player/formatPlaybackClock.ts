/**
 * Clock label for in-progress playback. Unlike catalog `formatDuration`, this
 * accepts `0` so the scrubber can show `0:00` before the first tick.
 */
export function formatPlaybackClock(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '0:00'
    }
    const total = Math.floor(seconds)
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const remaining = total % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
    }
    return `${minutes}:${String(remaining).padStart(2, '0')}`
}
