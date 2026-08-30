import 'server-only'

import {redirect} from 'next/navigation'

import type {SiteConfig} from '@directwerk/api/types'

import {DEFAULT_STUDIO_SITE_CONFIG} from '@/lib/site/defaultStudioSiteConfig'
import {fetchSiteConfigServerOptional} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

export async function resolveStudioSiteContext(): Promise<{
    host: string | null
    config: SiteConfig
}> {
    const host = await getTenantHost()
    if (host === null) {
        return {host: null, config: DEFAULT_STUDIO_SITE_CONFIG}
    }

    const config = await fetchSiteConfigServerOptional(host)
    if (config === null) {
        return {host, config: DEFAULT_STUDIO_SITE_CONFIG}
    }

    return {host, config}
}

export async function requireStudioSiteConfig(): Promise<{
    host: string
    config: SiteConfig
}> {
    const host = await getTenantHost()
    if (host === null) {
        redirect('/login')
    }

    const config = await fetchSiteConfigServerOptional(host)
    if (config === null) {
        redirect('/login?reason=workspace')
    }

    return {host, config}
}
