'use client'

import Link from 'next/link'
import {useParams} from 'next/navigation'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import PageHeader from '@directwerk/ui/components/page-header'

import {getPublicArticle} from '@/lib/api/client'
import type {PublicArticle} from '@/lib/api/types'
import {formatPublishedAt} from '@/lib/format'
import type {TenantHost} from '@/lib/tenants'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

export default function ArticleDetailPage() {
    const params = useParams<{slug: string}>()
    const slug = typeof params.slug === 'string' ? params.slug : ''
    const tenantHost = useSelectedTenant()
    const invalidSlug = slug.length === 0
    const swrKey = invalidSlug
        ? null
        : (['public-article', tenantHost, slug] as const)
    const {data: article, error, isLoading} = useSWR<PublicArticle>(
        swrKey,
        ([, host, articleSlug]: readonly [string, TenantHost, string]) =>
            getPublicArticle(host, articleSlug),
    )

    const errorMessage = invalidSlug
        ? 'Invalid article slug.'
        : error instanceof Error
          ? error.message
          : error
            ? 'Unable to load article.'
            : null

    return (
        <div className="page-container space-y-6">
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/articles">← Articles</Link>
            {isLoading && <p>Loading…</p>}
            {errorMessage !== null && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}
            {article !== undefined && !isLoading && errorMessage === null && (
                <article className="space-y-8">
                    <PageHeader title={article.title} description={formatPublishedAt(article.publishedAt)} actions={<Badge>{article.accessPolicy}</Badge>} />
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
