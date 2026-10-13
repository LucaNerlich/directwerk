/**
 * Formats a duration in seconds as a clock-style time string.
 *
 * @param seconds - The duration in seconds
 * @returns `H:MM:SS` when the duration is at least an hour, otherwise `M:SS`;
 *          `null` for `null` or non-positive values
 */
export function formatDuration(seconds: number | null): string | null {
    if (seconds === null || seconds <= 0) {
        return null
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}
