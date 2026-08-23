import type {Metadata} from 'next'
import Link from 'next/link'
import {notFound} from 'next/navigation'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import PageHeader from '@directwerk/ui/components/page-header'

import {formatPublishedAt} from '@/lib/format'
import {fetchPublicArticleServer} from '@/lib/site/fetchPublicContentServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

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
        // Metadata is best-effort; the page itself handles upstream failures.
        return {}
    }
}

export default async function ArticleDetailPage({params}: ArticlePageProps) {
    const slug = await resolveSlug(params)
    if (slug.length === 0) {
        notFound()
    }

    let article = null
    let loadError: string | null = null
    try {
        const host = await getTenantHost()
        article = await fetchPublicArticleServer(host, slug)
        if (article === null) {
            notFound()
        }
    } catch (error: unknown) {
        loadError =
            error instanceof Error
                ? error.message
                : 'Unable to load article.'
    }

    return (
        <div className="page-container space-y-6">
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/articles">← Beiträge</Link>
            {loadError !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            )}
            {article !== null && loadError === null && (
                <article className="space-y-8">
                    <PageHeader
                        title={article.title}
                        description={formatPublishedAt(article.publishedAt)}
                        actions={<Badge>{article.accessPolicy}</Badge>}
                    />
                    {article.accessPolicy === 'PAID' && article.body === null ? (
                        <Alert><AlertDescription>
                            This is paid content. Public visitors only see the teaser.
                            {article.excerpt !== null && article.excerpt.length > 0
                                ? ` ${article.excerpt}`
                                : ''}
                        </AlertDescription></Alert>
                    ) : article.body !== null && article.body.length > 0 ? (
                        <div
                            className="editorial-copy"
                            dangerouslySetInnerHTML={{__html: article.body}}
                        />
                    ) : (
                        <p>No body content.</p>
                    )}
                </article>
            )}
        </div>
    )
}
