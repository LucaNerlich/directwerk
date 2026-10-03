import type {MetadataRoute} from 'next'

import {locales} from '@/lib/i18n/config'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

export default async function robots(): Promise<MetadataRoute.Robots> {
    let host: string | null
    try {
        host = await getTenantHost()
    } catch {
        host = null
    }
    const origin = host !== null ? resolveTenantOrigin(host) : null

    const privatePrefixes = ['/account', '/login', '/checkout', '/downloads']
    const disallow = [
        '/api/',
        ...locales.flatMap((lang) =>
            privatePrefixes.map((prefix) => `/${lang}${prefix}`),
        ),
        // Tokenized private subscriber feeds (`/feeds/<tenant>/u/<token>…`).
        '/feeds/*/u/',
        '/feeds/*/articles/u/',
    ]

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow,
        },
        ...(origin !== null ? {sitemap: `${origin}/sitemap.xml`} : {}),
    }
}
