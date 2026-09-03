import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import {buildArticleJsonLd, serializeJsonLd} from '@/lib/site/jsonLd'
import {fetchPublicArticleServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {resolveTenantOrigin} from '@/lib/site/siteOrigin'

import ArticleDetailClient from './article-detail-client'

interface ArticlePageProps {
    params: Promise<{slug: string}>
}

function resolveSlug(params: Promise<{slug: string}>): Promise<string> {
    return params.then(({slug}) => (typeof slug === 'string' ? slug : ''))
}

export async function generateMetadata({
    params,
}: ArticlePageProps): Promise<Metadata> {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
        return {}
    }

    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        const article = await fetchPublicArticleServer(host, slug)
        if (article === null) {
            return {}
        }

        const description =
            article.seoDescription ?? article.excerpt ?? undefined
        return {
            title: article.title,
            description,
            alternates: {canonical: `/articles/${slug}`},
            openGraph: {
                title: article.title,
                description,
                type: 'article',
                publishedTime: article.publishedAt ?? undefined,
            },
        }
    } catch {
        return {}
    }
}

export default async function ArticleDetailPage({params}: ArticlePageProps) {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
        notFound()
    }

    let initialArticle = null
    let origin = 'https://localhost'
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        origin = resolveTenantOrigin(host)
        initialArticle = await fetchPublicArticleServer(host, slug)
    } catch {
        initialArticle = null
    }

    if (initialArticle === null) {
        return <ArticleDetailClient slug={slug} />
    }

    const articleJsonLd = buildArticleJsonLd({article: initialArticle, origin})
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: serializeJsonLd(articleJsonLd)}}
            />
            <ArticleDetailClient slug={slug} initialPublicArticle={initialArticle} />
        </>
    )
}
