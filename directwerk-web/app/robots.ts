import type {MetadataRoute} from 'next'

import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

export default async function robots(): Promise<MetadataRoute.Robots> {
    // Same tenant resolution as every other route: direct `host` first,
    // validated. Never trust a forwarded host verbatim — a spoofed value would
    // poison the sitemap origin (SEO/cache poisoning).
    let host: string | null
    try {
        host = await getTenantHost()
    } catch {
        host = null
    }
    const origin = host !== null ? resolveTenantOrigin(host) : null

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/api/',
                '/account',
                '/login',
                '/checkout',
                '/downloads',
                // Tokenized private subscriber feeds (`/feeds/<tenant>/u/<token>…`).
                '/feeds/*/u/',
                '/feeds/*/articles/u/',
            ],
        },
        ...(origin !== null ? {sitemap: `${origin}/sitemap.xml`} : {}),
    }
}
