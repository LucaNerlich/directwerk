import type {MetadataRoute} from 'next'
import {headers} from 'next/headers'

import {fetchPublicArticleSlugsServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

function originFromHost(raw: string): string {
    const host = raw.includes('://') ? new URL(raw).host : raw
    return `https://${host}`
}

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headerStore = await headers()
    const rawHost =
        headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    const origin =
        rawHost !== null ? originFromHost(rawHost) : 'https://localhost'

    const staticRoutes: MetadataRoute.Sitemap = [
        '',
        '/articles',
        '/episodes',
        '/feeds',
        '/pricing',
    ].map((path) => ({
        url: `${origin}${path}`,
        lastModified: new Date(),
    }))

    let articleEntries: MetadataRoute.Sitemap = []
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        const articles = await fetchPublicArticleSlugsServer(host)
        articleEntries = articles.map((article) => ({
            url: `${origin}/articles/${article.slug}`,
            lastModified: article.publishedAt ?? undefined,
        }))
    } catch {
        // A failing backend must not break the whole sitemap.
    }

    return [...staticRoutes, ...articleEntries]
}
