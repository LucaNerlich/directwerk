import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import {buildPodcastEpisodeJsonLd} from '@/lib/site/jsonLd'
import {fetchPublicEpisodeServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

import EpisodeDetailClient from './episode-detail-client'

interface EpisodePageProps {
    params: Promise<{slug: string}>
}

function resolveSlug(params: Promise<{slug: string}>): Promise<string> {
    return params.then(({slug}) => (typeof slug === 'string' ? slug : ''))
}

export async function generateMetadata({
    params,
}: EpisodePageProps): Promise<Metadata> {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
        return {}
    }

    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        const episode = await fetchPublicEpisodeServer(host, slug)
        if (episode === null) {
            return {}
        }

        const description =
            episode.description !== null
                ? episode.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
                : undefined
        return {
            title: episode.title,
            description,
            alternates: {canonical: `/episodes/${slug}`},
            openGraph: {
                title: episode.title,
                description,
                type: 'article',
                publishedTime: episode.publishedAt ?? undefined,
            },
        }
    } catch {
        // Metadata is best-effort; the page itself handles upstream failures.
        return {}
    }
}

export default async function EpisodeDetailPage({params}: EpisodePageProps) {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
        notFound()
    }

    let initialEpisode = null
    let origin = 'https://localhost'
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        origin = resolveTenantOrigin(host)
        initialEpisode = await fetchPublicEpisodeServer(host, slug)
    } catch {
        // Public catalog unavailable — the client component retries and can
        // still serve entitled episodes to logged-in subscribers.
        initialEpisode = null
    }

    if (initialEpisode === null) {
        // Unknown or paid/unpublished episode: the client component performs
        // the authenticated entitlement lookup for subscribers.
        return <EpisodeDetailClient slug={slug} />
    }

    const episodeJsonLd = buildPodcastEpisodeJsonLd({
        episode: initialEpisode,
        origin,
    })
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(episodeJsonLd)}}
            />
            <EpisodeDetailClient slug={slug} initialPublicEpisode={initialEpisode} />
        </>
    )
}
