import type {MetadataRoute} from 'next'
import {headers} from 'next/headers'

import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headerStore = await headers()
    const rawHost =
        headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    const origin = resolveTenantOrigin(rawHost)

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
        sitemap: `${origin}/sitemap.xml`,
    }
}
