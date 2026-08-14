'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {listPublicArticles} from '@/lib/api/client'
import type {PublicArticle} from '@/lib/api/types'
import {formatPublishedAt} from '@/lib/format'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

export default function ArticlesPage() {
    const tenantHost = useSelectedTenant()
    const [articles, setArticles] = useState<PublicArticle[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        listPublicArticles(tenantHost)
            .then((loaded) => {
                if (active) {
                    setArticles(loaded)
                }
            })
            .catch((error: unknown) => {
                if (active) {
                    setArticles([])
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load articles.',
                    )
                }
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [tenantHost])

    return (
        <div className="page-container space-y-8">
            <PageHeader eyebrow={tenantHost} title="Articles" description="Published stories from the selected tenant." />
            {isLoading && <p className="text-muted-foreground">Loading…</p>}
            {errorMessage !== null && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}
            {!isLoading && errorMessage === null && articles.length === 0 && (
                <EmptyState title="No published articles" description="Publish one in directwerk-studio to see it here." />
            )}
            {articles.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2">
                    {articles.map((article) => (
                        <Card key={article.id}>
                            <CardHeader>
                                <Badge variant="secondary">{article.accessPolicy}</Badge>
                                <CardTitle className="text-xl"><Link className="hover:underline" href={`/articles/${article.slug}`}>{article.title}</Link></CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-muted-foreground">
                                <p className="text-xs">{formatPublishedAt(article.publishedAt)}</p>
                            {article.excerpt !== null && article.excerpt.length > 0 && (
                                <p>{article.excerpt}</p>
                            )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
