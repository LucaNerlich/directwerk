/**
 * Client-side Umami tracking for the web audio player.
 *
 * Server-side `episode-download` events only cover delivery paths that pass
 * through the backend (RSS enclosure proxies, portal streams). The web
 * `<audio>` element plays direct CDN URLs, so site playback is reported from
 * here via the Umami tracker script (`window.umami`). The tracker only loads
 * when the tenant has the ANALYTICS module plus a valid website ID, so a
 * missing tracker means "tracking not configured" — never an error.
 *
 * Identity props mirror `EpisodeDownloadAnalyticsService` (`episodeSlug`,
 * `episodeId`, `slug`, optional `seriesSlug` / `episodeTitle` / `title`) so
 * Events → Properties stay comparable across download vs website play.
 */

export const EPISODE_PLAY_EVENT = 'episode-play'

/** Delivery channel for website `<audio>` plays (vs RSS/stream download sources). */
export const EPISODE_PLAY_SOURCE = 'web-player'

export interface EpisodePlayIdentity {
    /** Episode URL slug — required. */
    slug: string
    /** Numeric episode id when the catalog payload includes it. */
    episodeId?: number | null
    seriesSlug?: string | null
    /** Display title; truncated to match download analytics (≤200). */
    title?: string | null
}

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

function truncateProp(value: string): string {
    return value.length > 200 ? value.slice(0, 200) : value
}

/**
 * Reports a web-player playback start. Fail-open by design: returns false
 * (and never throws) when the tracker is absent — e.g. adblocker, Do Not
 * Track, or analytics not configured for the tenant.
 *
 * Callers must enforce once-per-play-session (see AudioPlayerContext): only
 * the first successful `play` after loading a track source should invoke this.
 */
export function trackEpisodePlay(identity: EpisodePlayIdentity): boolean {
    const slug = identity.slug
    if (slug.length === 0) {
        return false
    }
    const tracker = getTracker()
    if (tracker === null) {
        return false
    }

    const data: Record<string, string> = {
        url: `/episodes/${slug}`,
        slug,
        episodeSlug: slug,
        source: EPISODE_PLAY_SOURCE,
    }

    if (identity.episodeId !== null && identity.episodeId !== undefined) {
        data.episodeId = String(identity.episodeId)
    }
    const series = identity.seriesSlug?.trim()
    if (series !== undefined && series.length > 0) {
        data.seriesSlug = series
    }
    const title = identity.title?.trim()
    if (title !== undefined && title.length > 0) {
        const capped = truncateProp(title)
        data.title = capped
        data.episodeTitle = capped
    }

    try {
        void Promise.resolve(tracker.track(EPISODE_PLAY_EVENT, data)).catch(
            () => undefined,
        )
        return true
    } catch {
        return false
    }
}
