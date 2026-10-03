'use client'

import Link from 'next/link'
import {useSyncExternalStore} from 'react'

import PageHeader from '@directwerk/ui/components/page-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogMediaThumb from '@/components/CatalogMediaThumb'
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
import {formatPublishedAt} from '@/lib/format/dateTime'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

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
    const lang = useLocale()
    const {catalog, format} = useDictionary()
    const messages = {
        emptySlug: catalog.articleNotFound,
        loadFailed: catalog.articleLoadFailed,
        authRequired: catalog.articleAuthRequired,
    }
    const tenantHost = getWebClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products), lang)
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
        messages,
    })

    const isLocked = article !== null && article.body === null

    return (
        <DetailShell
            backHref={localizedPath(lang, '/articles')}
            backLabel={catalog.backArticles}
            isLoading={status === 'loading'}
            isAuthenticated={isAuthenticated}
            errorMessage={status === 'error' ? errorMessage : null}
            onRetry={retry}
            notFound={
                status === 'not-found'
                    ? {
                          title: catalog.articleUnavailableTitle,
                          description: isAuthenticated
                              ? catalog.articleUnavailableAuth
                              : catalog.articleUnavailableGuest,
                      }
                    : null
            }
            unlockHref={unlockTarget}
        >
            {article !== null ? (
                <article className="max-w-3xl space-y-8">
                    <CatalogMediaThumb
                        alt={article.title}
                        priority
                        size="lg"
                        src={article.heroImageUrl}
                    />
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
                                    formatPublishedAt(article.publishedAt, lang, format),
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
                            title={catalog.lockedEpisodeTitle}
                            description={
                                <>
                                    {isAuthenticated ? (
                                        catalog.lockedArticleDescAuth
                                    ) : (
                                        <>
                                            {catalog.lockedArticleDescGuestBefore}
                                            <Link href={localizedPath(lang, '/login')}>
                                                {catalog.lockedArticleLoginLink}
                                            </Link>
                                            {catalog.lockedArticleDescGuestAfter}
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
                            {catalog.noArticleBody}
                        </p>
                    )}
                </article>
            ) : null}
        </DetailShell>
    )
}
