/**
 * Client-side Umami tracking for the web audio player.
 *
 * Server-side `episode-download` events only cover delivery paths that pass
 * through the backend (RSS enclosure proxies, portal streams). The web
 * `<audio>` element plays direct CDN URLs, so site playback is reported from
 * here via the Umami tracker script (`window.umami`). The tracker only loads
 * when the tenant has the ANALYTICS module plus a valid website ID, so a
 * missing tracker means "tracking not configured" — never an error.
 */

export const EPISODE_PLAY_EVENT = 'episode-play'

interface UmamiTracker {
    track: (eventName: string, data?: Record<string, string>) => unknown
}

function getTracker(): UmamiTracker | null {
    if (typeof window === 'undefined') {
        return null
    }
    const candidate: unknown = (window as unknown as {umami?: unknown}).umami
    if (candidate === null || typeof candidate !== 'object') {
        return null
    }
    if (typeof (candidate as {track?: unknown}).track !== 'function') {
        return null
    }
    return candidate as UmamiTracker
}

/**
 * Reports a web-player playback start. Fail-open by design: returns false
 * (and never throws) when the tracker is absent — e.g. adblocker, Do Not
 * Track, or analytics not configured for the tenant.
 */
export function trackEpisodePlay(slug: string): boolean {
    if (slug.length === 0) {
        return false
    }
    const tracker = getTracker()
    if (tracker === null) {
        return false
    }
    try {
        void tracker.track(EPISODE_PLAY_EVENT, {
            url: `/episodes/${slug}`,
            episodeSlug: slug,
        })
        return true
    } catch {
        return false
    }
}
