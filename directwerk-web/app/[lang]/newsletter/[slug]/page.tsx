import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import NewsletterSubscribePageClient from '@/components/newsletter/NewsletterSubscribePageClient'
import {isLocale} from '@/lib/i18n/config'
import {localizedPath} from '@/lib/i18n/paths'
import {fetchPublicNewsletterListServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

interface NewsletterListPageProps {
    params: Promise<{lang: string; slug: string}>
}

function resolveSlug(params: Promise<{slug: string}>): Promise<string> {
    return params.then(({slug}) => (typeof slug === 'string' ? slug : ''))
}

export async function generateMetadata({
    params,
}: NewsletterListPageProps): Promise<Metadata> {
    const {lang} = await params
    const slug = await resolveSlug(params)
    if (slug.length === 0 || !isLocale(lang)) {
        return {}
    }

    try {
        const host = await getTenantHost()
        if (host === null) {
            return {}
        }
        const list = await fetchPublicNewsletterListServer(host, slug)
        if (list === null) {
            return {}
        }
        return {
            title: list.name,
            description: list.description ?? undefined,
            alternates: {canonical: localizedPath(lang, `/newsletter/${slug}`)},
        }
    } catch {
        return {}
    }
}

export default async function NewsletterListSubscribePage({
    params,
}: NewsletterListPageProps): Promise<React.JSX.Element> {
    const {lang} = await params
    const slug = await resolveSlug(params)
    if (slug.length === 0 || !isLocale(lang)) {
        notFound()
    }

    let list = null
    try {
        const host = await getTenantHost()
        if (host !== null) {
            list = await fetchPublicNewsletterListServer(host, slug)
        }
    } catch {
        list = null
    }

    return <NewsletterSubscribePageClient list={list} slug={slug} />
}
