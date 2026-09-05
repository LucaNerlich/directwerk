'use client'

import Link from 'next/link'
import {useSyncExternalStore} from 'react'

import PageHeader from '@directwerk/ui/components/page-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import ContentMetaLine from '@/components/ContentMetaLine'
import DetailShell, {DetailLockedPanel} from '@/components/DetailShell'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {
    fetchEntitledArticleBySlug,
    fetchPublicArticleBySlug,
} from '@/lib/catalog/articleDetail'
import {useEntitledDetail} from '@/lib/catalog/useEntitledDetail'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import type {PublicArticle} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

const MESSAGES = {
    emptySlug: 'Beitrag nicht gefunden.',
    loadFailed: 'Beitrag konnte nicht geladen werden.',
    authRequired: 'Sitzung abgelaufen — bitte erneut anmelden.',
} as const

export default function ArticleDetailClient({
    slug,
    initialPublicArticle = null,
}: {
    slug: string
    /** Preloaded public catalog entry rendered server-side; skips the public fetch. */
    initialPublicArticle?: PublicArticle | null
}): React.JSX.Element {
    const tenantHost = getWebClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products))
    const {item: article, status, errorMessage, retry} = useEntitledDetail<PublicArticle>({
        slug,
        initial: initialPublicArticle,
        isAuthenticated,
        tenantHost,
        // The API serves single articles by slug (public + entitled), so no
        // list scan is needed here — unlike episodes.
        loadPublic: () => fetchPublicArticleBySlug(slug),
        loadEntitled: async () =>
            (await fetchEntitledArticleBySlug(slug)) ??
            (await fetchPublicArticleBySlug(slug)),
        messages: MESSAGES,
    })

    const isLocked = article !== null && article.body === null

    return (
        <DetailShell
            backHref="/articles"
            backLabel="← Beiträge"
            isLoading={status === 'loading'}
            isAuthenticated={isAuthenticated}
            errorMessage={status === 'error' ? errorMessage : null}
            onRetry={retry}
            notFound={
                status === 'not-found'
                    ? {
                          title: 'Beitrag nicht verfügbar',
                          description: isAuthenticated
                              ? 'Dieser Beitrag wurde nicht gefunden oder ist nicht für dich freigeschaltet. Eine Mitgliedschaft schaltet bezahlte Beiträge frei.'
                              : 'Dieser Beitrag ist nicht im öffentlichen Katalog. Bezahlte Beiträge erscheinen nach der Anmeldung mit aktiver Mitgliedschaft.',
                      }
                    : null
            }
            unlockHref={unlockTarget}
        >
            {article !== null ? (
                <article className="max-w-3xl space-y-8">
                    <PageHeader
                        title={article.title}
                        description={
                            <ContentMetaLine
                                items={[
                                    article.categories.length > 0
                                        ? article.categories
                                              .map((category) => category.name)
                                              .join(', ')
                                        : null,
                                    formatPublishedAt(article.publishedAt),
                                ]}
                            />
                        }
                        actions={
                            <AccessPolicyBadge
                                policy={article.accessPolicy}
                                isEntitled={
                                    article.accessPolicy === 'PAID'
                                        ? !isLocked
                                        : undefined
                                }
                            />
                        }
                    />
                    {article.accessPolicy === 'PAID' && article.body === null ? (
                        <DetailLockedPanel
                            title="Mitgliedschaft nötig"
                            description={
                                <>
                                    {isAuthenticated ? (
                                        <>Bezahlter Beitrag — fehlende Freischaltung.</>
                                    ) : (
                                        <>
                                            Bezahlter Beitrag —{' '}
                                            <Link href="/login">anmelden</Link>, um ihn
                                            freizuschalten.
                                        </>
                                    )}
                                    {article.excerpt !== null &&
                                    article.excerpt.length > 0
                                        ? ` ${article.excerpt}`
                                        : ''}
                                </>
                            }
                            isAuthenticated={isAuthenticated}
                            unlockHref={unlockTarget}
                        />
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
        </DetailShell>
    )
}
