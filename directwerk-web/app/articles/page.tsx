'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {listPublicArticles} from '@/lib/api/client'
import type {PublicArticle} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'

export default function ArticlesPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
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
            <PageHeader
                eyebrow="Magazin"
                title="Beiträge"
                description={
                    isAuthenticated
                        ? 'Angemeldet: freie und für dich freigeschaltete Beiträge.'
                        : 'Öffentlich: nur freie Beiträge. Anmelden für bezahlte Inhalte.'
                }
            />
            <SubscriberContextBanner showWhenAuthenticated={false} />

            {isLoading ? <CardGridSkeleton cards={4} columns={2} /> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && articles.length === 0 ? (
                <EmptyState
                    title="Noch keine Beiträge"
                    description="Veröffentlichte Beiträge erscheinen hier."
                    action={
                        !isAuthenticated ? (
                            <Button nativeButton={false} render={<Link href="/login" />}>
                                Anmelden
                            </Button>
                        ) : undefined
                    }
                />
            ) : null}
            {articles.length > 0 ? (
                <div className="grid gap-5 sm:grid-cols-2">
                    {articles.map((article) => (
                        <Card key={article.id} className="flex flex-col">
                            <CardHeader className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <AccessPolicyBadge policy={article.accessPolicy} />
                                    {article.categories.length > 0 ? (
                                        <span className="text-xs text-muted-foreground">
                                            {article.categories.map((category) => category.name).join(', ')}
                                        </span>
                                    ) : null}
                                </div>
                                <CardTitle className="text-xl">
                                    <Link
                                        className="hover:underline"
                                        href={`/articles/${encodeURIComponent(article.slug)}`}
                                    >
                                        {article.title}
                                    </Link>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="mt-auto space-y-3 text-muted-foreground">
                                <p className="text-xs">
                                    {formatPublishedAt(article.publishedAt)}
                                </p>
                                {article.excerpt !== null && article.excerpt.length > 0 ? (
                                    <p className="line-clamp-3 text-sm leading-6">
                                        {article.excerpt}
                                    </p>
                                ) : null}
                                <Link
                                    className="inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                    href={`/articles/${encodeURIComponent(article.slug)}`}
                                >
                                    Weiterlesen
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : null}
        </PageStack>
    )
}
