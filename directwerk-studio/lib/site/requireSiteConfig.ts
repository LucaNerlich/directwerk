import 'server-only'

import {cookies, headers} from 'next/headers'
import {redirect} from 'next/navigation'

import type {SiteConfig} from '@directwerk/api/types'

import {LOCALE_COOKIE, type Locale} from '@/lib/i18n/config'
import {preferredLocale} from '@/lib/i18n/matchLocale'
import {localizedPath} from '@/lib/i18n/paths'
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

async function resolveLoginRedirect(lang?: Locale): Promise<string> {
    if (lang !== undefined) {
        return localizedPath(lang, '/login')
    }
    const headerStore = await headers()
    const cookieStore = await cookies()
    const preferred = preferredLocale(
        headerStore.get('accept-language'),
        cookieStore.get(LOCALE_COOKIE)?.value,
    )
    return localizedPath(preferred, '/login')
}

export async function requireStudioSiteConfig(lang?: Locale): Promise<{
    host: string
    config: SiteConfig
}> {
    const host = await getTenantHost()
    if (host === null) {
        redirect(await resolveLoginRedirect(lang))
    }

    const config = await fetchSiteConfigServerOptional(host)
    return {host, config: config ?? DEFAULT_STUDIO_SITE_CONFIG}
}
