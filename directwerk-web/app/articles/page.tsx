'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {listPublicArticles} from '@/lib/api/client'
import type {PublicArticle} from '@directwerk/api/types'
import {formatPublishedAt} from '@/lib/format'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export default function ArticlesPage() {
    const tenantHost = getClientTenantHost()
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
                            : 'Beiträge konnten nicht geladen werden.',
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
        <PageStack className="page-container">
            <PageHeader eyebrow="Magazin" title="Beiträge" description="Veröffentlichte Geschichten und Hintergründe." />
            {isLoading && <p className="text-sm text-muted-foreground">Wird geladen…</p>}
            {errorMessage !== null && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}
            {!isLoading && errorMessage === null && articles.length === 0 && (
                <EmptyState title="Noch keine Beiträge" description="Veröffentlichte Beiträge erscheinen hier." />
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
        </PageStack>
    )
}
