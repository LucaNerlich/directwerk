import type {MetadataRoute} from 'next'
import {headers} from 'next/headers'

function originFromHost(raw: string): string {
    const host = raw.includes('://') ? new URL(raw).host : raw
    return `https://${host}`
}

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headerStore = await headers()
    const rawHost =
        headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    const origin =
        rawHost !== null ? originFromHost(rawHost) : 'https://localhost'

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/api/', '/account', '/login', '/checkout'],
        },
        sitemap: `${origin}/sitemap.xml`,
    }
}
