'use client'

import Link from 'next/link'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import {listMyArticles, listPublicArticles} from '@/lib/api/client'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PublicArticle} from '@directwerk/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getClientTenantHost} from '@/lib/tenant/clientHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function ArticleDetailClient({
    slug,
    initialPublicArticle = null,
}: {
    slug: string
    /** Preloaded public catalog entry rendered server-side; skips the public fetch. */
    initialPublicArticle?: PublicArticle | null
}): React.JSX.Element {
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const [article, setArticle] = useState<PublicArticle | null>(
        initialPublicArticle,
    )
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(initialPublicArticle === null)

    useEffect(() => {
        let active = true
        if (slug.length === 0) {
            setErrorMessage('Beitrag nicht gefunden.')
            setIsLoading(false)
            return
        }

        if (initialPublicArticle !== null && !isAuthenticated) {
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setErrorMessage(null)

        const load = isAuthenticated
            ? listMyArticles(tenantHost)
            : listPublicArticles(tenantHost)

        load
            .then((articles) => {
                if (!active) {
                    return
                }
                const match = articles.find((item) => item.slug === slug) ?? null
                setArticle(match)
                if (match === null) {
                    setErrorMessage(
                        isAuthenticated
                            ? 'Beitrag nicht gefunden oder nicht freigeschaltet.'
                            : 'Beitrag nicht im öffentlichen Katalog. Bei bezahlten Beiträgen bitte anmelden.',
                    )
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    setErrorMessage('Sitzung abgelaufen — bitte erneut anmelden.')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Beitrag konnte nicht geladen werden.',
                )
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [tenantHost, isAuthenticated, slug, initialPublicArticle])

    return (
        <PageStack className="page-container">
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/articles">
                ← Beiträge
            </Link>
            {isLoading ? <p className="text-sm text-muted-foreground">Wird geladen…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {article !== null ? (
                <article className="max-w-3xl space-y-8">
                    <PageHeader
                        title={article.title}
                        description={
                            <>
                                {formatPublishedAt(article.publishedAt)}
                                {article.categories.length > 0 ? (
                                    <>
                                        {' · '}
                                        {article.categories.map((category) => category.name).join(', ')}
                                    </>
                                ) : null}
                            </>
                        }
                        actions={<AccessPolicyBadge policy={article.accessPolicy} />}
                    />
                    {article.accessPolicy === 'PAID' && article.body === null ? (
                        <Alert>
                            <AlertDescription>
                                {isAuthenticated ? (
                                    <>
                                        Bezahlter Beitrag — fehlende Freischaltung.{' '}
                                        <Link href="/pricing">Tarife ansehen</Link>
                                    </>
                                ) : (
                                    <>
                                        Bezahlter Beitrag —{' '}
                                        <Link href="/login">anmelden</Link>, um ihn
                                        freizuschalten.
                                    </>
                                )}
                                {article.excerpt !== null && article.excerpt.length > 0
                                    ? ` ${article.excerpt}`
                                    : ''}
                            </AlertDescription>
                        </Alert>
                    ) : article.body !== null && article.body.length > 0 ? (
                        <div
                            className="content-prose"
                            // Defense-in-depth: the API sanitizes on write, but
                            // stored HTML is re-sanitized here so a compromised
                            // or bypassed record cannot XSS the public site.
                            dangerouslySetInnerHTML={{__html: sanitizeContentHtml(article.body)}}
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Für diesen Beitrag ist noch kein Text verfügbar.
                        </p>
                    )}
                </article>
            ) : null}
        </PageStack>
    )
}
