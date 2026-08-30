import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import {fetchPublicArticleServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

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
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        initialArticle = await fetchPublicArticleServer(host, slug)
    } catch {
        initialArticle = null
    }

    if (initialArticle === null) {
        return <ArticleDetailClient slug={slug} />
    }

    return <ArticleDetailClient slug={slug} initialPublicArticle={initialArticle} />
}
