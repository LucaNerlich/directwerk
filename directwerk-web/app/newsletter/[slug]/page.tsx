import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import NewsletterSubscribePageClient from '@/components/newsletter/NewsletterSubscribePageClient'
import {fetchPublicNewsletterListServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

interface NewsletterListPageProps {
    params: Promise<{slug: string}>
}

function resolveSlug(params: Promise<{slug: string}>): Promise<string> {
    return params.then(({slug}) => (typeof slug === 'string' ? slug : ''))
}

export async function generateMetadata({
    params,
}: NewsletterListPageProps): Promise<Metadata> {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
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
            alternates: {canonical: `/newsletter/${slug}`},
        }
    } catch {
        return {}
    }
}

export default async function NewsletterListSubscribePage({
    params,
}: NewsletterListPageProps): Promise<React.JSX.Element> {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
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
