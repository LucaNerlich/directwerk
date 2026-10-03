'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import ListPanel from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogMediaThumb from '@/components/CatalogMediaThumb'
import CatalogRow, {LockedCatalogAction} from '@/components/CatalogRow'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import {PublicFeedStrip} from '@/components/PublicFeedFooter'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {usePublicArticles} from '@/lib/catalog/usePublicArticles'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {webPublicArticleFeedUrl} from '@/lib/feeds/webPublicFeedUrl'
import {formatPublishedAt} from '@/lib/format/dateTime'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {interpolate} from '@/lib/i18n/interpolate'
import {localizedPath} from '@/lib/i18n/paths'

/** Render long article catalogs in chunks instead of one giant DOM list. */
const PAGE_SIZE = 20

export default function ArticlesPage() {
    const lang = useLocale()
    const {catalog, common, format, nav} = useDictionary()
    const tenantHost = getWebClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, articles, errorMessage, isLoading} = usePublicArticles({
        tenantHost,
        isAuthenticated,
        authRequiredMessage: catalog.articleAuthRequired,
        loadErrorMessage: catalog.articleLoadFailed,
    })
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products), lang)
    const publicArticleFeedUrl =
        siteConfig === null ? null : webPublicArticleFeedUrl(siteConfig, tenantHost)
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    useEffect(() => {
        setVisibleCount(PAGE_SIZE)
    }, [isAuthenticated, tenantHost])
    const featured = articles[0] ?? null
    const listArticles = articles.slice(1, visibleCount)
    const remainingAfterVisible = Math.max(0, articles.length - visibleCount)

    return (
        <PageStack className="page-container">
            <PageHeader
                eyebrow={catalog.articlesEyebrow}
                title={catalog.articlesTitle}
                description={
                    isAuthenticated
                        ? catalog.articlesDescAuth
                        : catalog.articlesDescGuest
                }
            />
            {publicArticleFeedUrl !== null ? (
                <PublicFeedStrip kind="articles" publicFeedUrl={publicArticleFeedUrl} />
            ) : null}
            <SubscriberContextBanner showWhenAuthenticated={false} />

            {isLoading ? <ListPanelSkeleton rows={5} /> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && articles.length === 0 ? (
                <EmptyState
                    title={catalog.noArticlesTitle}
                    description={catalog.noArticlesDescription}
                    action={
                        !isAuthenticated ? (
                            <Button nativeButton={false} render={<Link href={localizedPath(lang, '/login')} />}>
                                {nav.login}
                            </Button>
                        ) : undefined
                    }
                />
            ) : null}
            {articles.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={interpolate(catalog.visibleCountArticles, {
                            count: articles.length,
                            noun:
                                articles.length === 1
                                    ? catalog.nounArticle
                                    : catalog.nounArticles,
                        })}
                        title={catalog.publishedArticlesTitle}
                    />
                    {featured !== null ? (
                        <FeatureCard
                            eyebrow={common.newest}
                            title={
                                <Link
                                    className="hover:underline"
                                    href={localizedPath(lang, `/articles/${encodeURIComponent(featured.slug)}`)}
                                >
                                    {featured.title}
                                </Link>
                            }
                            description={
                                <>
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                        <AccessPolicyBadge
                                            policy={featured.accessPolicy}
                                            isEntitled={
                                                featured.accessPolicy === 'PAID'
                                                    ? featured.body !== null
                                                    : undefined
                                            }
                                        />
                                        {featured.categories.length > 0
                                            ? featured.categories
                                                  .map((category) => category.name)
                                                  .join(', ')
                                            : null}
                                        {formatPublishedAt(featured.publishedAt, lang, format)}
                                    </span>
                                    {featured.excerpt !== null &&
                                    featured.excerpt.length > 0 ? (
                                        <span className="mt-2 line-clamp-3 block">
                                            {featured.excerpt}
                                        </span>
                                    ) : null}
                                </>
                            }
                        >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                                <CatalogMediaThumb
                                    alt={featured.title}
                                    priority
                                    size="lg"
                                    src={featured.heroImageUrl}
                                />
                                <div className="flex flex-wrap gap-2">
                                    {featured.body !== null ? (
                                        <Button
                                            nativeButton={false}
                                            render={
                                                <Link
                                                    href={localizedPath(lang, `/articles/${encodeURIComponent(featured.slug)}`)}
                                                />
                                            }
                                        >
                                            {common.read}
                                        </Button>
                                    ) : featured.accessPolicy === 'PAID' ? (
                                        <LockedCatalogAction
                                            isAuthenticated={isAuthenticated}
                                            unlockHref={unlockTarget}
                                        />
                                    ) : null}
                                </div>
                            </div>
                        </FeatureCard>
                    ) : null}
                    {listArticles.length > 0 ? (
                        <ListPanel>
                            {listArticles.map((article) => {
                                const href = localizedPath(lang, `/articles/${encodeURIComponent(article.slug)}`)
                                const isLocked =
                                    article.accessPolicy === 'PAID' && article.body === null
                                return (
                                    <CatalogRow
                                        key={article.id}
                                        href={href}
                                        title={article.title}
                                        imageUrl={article.heroImageUrl}
                                        imageAlt={article.title}
                                        badge={
                                            <AccessPolicyBadge
                                                policy={article.accessPolicy}
                                                isEntitled={
                                                    article.accessPolicy === 'PAID'
                                                        ? !isLocked
                                                        : undefined
                                                }
                                            />
                                        }
                                        metaItems={[
                                            article.categories.length > 0
                                                ? article.categories
                                                      .map((category) => category.name)
                                                      .join(', ')
                                                : null,
                                            formatPublishedAt(article.publishedAt, lang, format),
                                        ]}
                                        excerpt={article.excerpt}
                                        action={
                                            article.body !== null ? (
                                                <Button
                                                    nativeButton={false}
                                                    render={<Link href={href} />}
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    {common.read}
                                                </Button>
                                            ) : isLocked ? (
                                                <LockedCatalogAction
                                                    isAuthenticated={isAuthenticated}
                                                    unlockHref={unlockTarget}
                                                />
                                            ) : (
                                                <span className="max-w-32 text-right text-xs text-muted-foreground">
                                                    {catalog.noText}
                                                </span>
                                            )
                                        }
                                    />
                                )
                            })}
                        </ListPanel>
                    ) : null}
                    {remainingAfterVisible > 0 ? (
                        <div>
                            <Button
                                onClick={() =>
                                    setVisibleCount((current) => current + PAGE_SIZE)
                                }
                                type="button"
                                variant="outline"
                            >
                                {interpolate(common.showMore, {count: remainingAfterVisible})}
                            </Button>
                        </div>
                    ) : null}
                </section>
            ) : null}
        </PageStack>
    )
}
