import type {MetadataRoute} from 'next'
import {headers} from 'next/headers'

import {parseTenantHost} from '@directwerk/api/proxy'

import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headerStore = await headers()
    const rawHost =
        headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    // Never trust the forwarded host verbatim — a spoofed value would poison
    // the sitemap origin (SEO/cache poisoning). Validate first.
    const firstHost = rawHost?.split(',')[0]?.trim() ?? null
    const validatedHost = parseTenantHost(firstHost)
    const origin =
        validatedHost !== null ? resolveTenantOrigin(validatedHost) : null

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
