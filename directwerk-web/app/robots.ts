import type {MetadataRoute} from 'next'
import {headers} from 'next/headers'

function originFromHost(raw: string): string {
    const host = raw.includes('://') ? new URL(raw).host : raw
    return `https://${host}`
}

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
    let origin = 'https://localhost'
    try {
        const headerStore = await headers()
        const rawHost =
            headerStore.get('x-forwarded-host') ?? headerStore.get('host')
        if (rawHost !== null) {
            origin = originFromHost(rawHost)
        }
    } catch {
        // Fall through with the default origin.
    }

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/account', '/login', '/checkout'],
        },
        sitemap: `${origin}/sitemap.xml`,
    }
}
