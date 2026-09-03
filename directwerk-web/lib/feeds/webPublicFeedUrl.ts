'use client'

import {
    resolvePublicArticleFeedUrl,
    resolvePublicPodcastFeedUrl,
} from '@directwerk/api/urls/feedUrls'
import type {PublicSiteConfig} from '@directwerk/api/types'

function webOrigin(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined
    }
    return window.location.origin
}

/** Same-origin public article feed URL for the web app's `/feeds/**` proxy. */
export function webPublicArticleFeedUrl(
    config: PublicSiteConfig,
    tenantHost: string,
): string | null {
    return resolvePublicArticleFeedUrl(config, {
        webOrigin: webOrigin(),
        originHost: tenantHost,
    })
}

/** Both same-origin public feed URLs at once (podcast + articles). */
export function webPublicFeedUrls(
    config: PublicSiteConfig,
    tenantHost: string,
): {podcast: string | null; articles: string | null} {
    return {
        podcast: webPublicPodcastFeedUrl(config, tenantHost),
        articles: webPublicArticleFeedUrl(config, tenantHost),
    }
}

/** Same-origin public podcast feed URL for the web app's `/feeds/**` proxy. */
export function webPublicPodcastFeedUrl(
    config: PublicSiteConfig,
    tenantHost: string,
): string | null {
    return resolvePublicPodcastFeedUrl(config, {
        webOrigin: webOrigin(),
        originHost: tenantHost,
    })
}
