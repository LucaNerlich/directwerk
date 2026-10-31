'use client'

import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogBrowseControls from '@/components/CatalogBrowseControls'
import CatalogMediaThumb from '@/components/CatalogMediaThumb'
import CatalogRow, {CATALOG_GRID_CLASSNAME, LockedCatalogAction} from '@/components/CatalogRow'
import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'
import {PublicFeedStrip} from '@/components/PublicFeedFooter'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {listMyArticles, listPublicArticles} from '@/lib/api/client'
import {
    browseArticles,
    collectCategories,
    groupByCategory,
    hasActiveBrowse,
    toggleId,
} from '@/lib/catalog/catalogBrowse'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import type {PublicArticle} from '@directwerk/api/types'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {webPublicArticleFeedUrl} from '@/lib/feeds/webPublicFeedUrl'
import {formatPublishedAt} from '@/lib/format/dateTime'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {interpolate} from '@/lib/i18n/interpolate'
import {localizedPath} from '@/lib/i18n/paths'

/** Render long article catalogs in chunks instead of one giant DOM list. */
const PAGE_SIZE = 20

export default function ArticlesClient({
    initialArticles,
}: {
    initialArticles: PublicArticle[] | null
}): React.JSX.Element {
    const lang = useLocale()
    const {catalog, common, format, nav} = useDictionary()
    const tenantHost = getWebClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, items: articles, errorMessage, isLoading} = usePublicCatalog({
        tenantHost,
        isAuthenticated,
        authRequiredMessage: catalog.articleAuthRequired,
        loadErrorMessage: catalog.articleLoadFailed,
        loadMine: listMyArticles,
        loadPublic: listPublicArticles,
        initialItems: initialArticles,
    })
    const products = usePublicProducts()
    const unlockTarget = unlockHref(findUnlockProduct(products), lang)
    const publicArticleFeedUrl = webPublicArticleFeedUrl(siteConfig, tenantHost)
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const [query, setQuery] = useState('')
    const [categoryIds, setCategoryIds] = useState<Set<number>>(() => new Set())

    useEffect(() => {
        setVisibleCount(PAGE_SIZE)
    }, [isAuthenticated, tenantHost])

    useEffect(() => {
        setVisibleCount(PAGE_SIZE)
    }, [query, categoryIds])

    const categoryChips = useMemo(() => collectCategories(articles), [articles])
    const browsing = hasActiveBrowse(query, categoryIds)
    const filtered = useMemo(
        () => browseArticles(articles, {query, categoryIds}),
        [articles, query, categoryIds],
    )
    const featured = !browsing ? (articles[0] ?? null) : null
    const listSource = useMemo(() => {
        if (featured === null) {
            return filtered
        }
        return filtered.filter((article) => article.id !== featured.id)
    }, [filtered, featured])
    const visibleItems = listSource.slice(0, visibleCount)
    const groups = useMemo(
        () =>
            groupByCategory(visibleItems, catalog.uncategorized, {
                categoryIds,
            }),
        [visibleItems, catalog.uncategorized, categoryIds],
    )
    const remainingAfterVisible = Math.max(0, listSource.length - visibleCount)
    const showBrowse = articles.length > 1 || categoryChips.length > 0
    const showGroupLabels =
        groups.length > 1 || groups.some((group) => group.key !== 'uncategorized')

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

            {isLoading ? <CardGridSkeleton cards={6} columns={3} /> : null}
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
                            count: browsing ? filtered.length : articles.length,
                            noun:
                                (browsing ? filtered.length : articles.length) === 1
                                    ? catalog.nounArticle
                                    : catalog.nounArticles,
                        })}
                        title={catalog.publishedArticlesTitle}
                    />
                    {showBrowse ? (
                        <CatalogBrowseControls
                            searchLabel={catalog.searchArticlesLabel}
                            searchPlaceholder={catalog.searchPlaceholder}
                            clearSearchLabel={catalog.clearSearch}
                            clearFiltersLabel={catalog.clearFilters}
                            categoriesLegend={catalog.categoriesLegend}
                            hitCountLabel={
                                browsing
                                    ? interpolate(catalog.hitCount, {count: filtered.length})
                                    : null
                            }
                            query={query}
                            onQueryChange={setQuery}
                            categories={categoryChips}
                            selectedCategoryIds={categoryIds}
                            onToggleCategory={(id) => setCategoryIds((prev) => toggleId(prev, id))}
                            onClear={() => {
                                setQuery('')
                                setCategoryIds(new Set())
                            }}
                            showClear={browsing}
                        />
                    ) : null}
                    {browsing && filtered.length === 0 ? (
                        <EmptyState
                            title={catalog.noBrowseMatchesTitle}
                            description={catalog.noBrowseMatchesDescription}
                            action={
                                <Button
                                    onClick={() => {
                                        setQuery('')
                                        setCategoryIds(new Set())
                                    }}
                                    type="button"
                                    variant="outline"
                                >
                                    {catalog.clearFilters}
                                </Button>
                            }
                        />
                    ) : null}
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
                    {filtered.length > 0
                        ? groups.map((group) => (
                              <div className="flex flex-col gap-3" key={group.key}>
                                  {showGroupLabels ? (
                                      <h3 className="text-base font-semibold tracking-tight">
                                          {group.label}
                                      </h3>
                                  ) : null}
                                  <ul className={CATALOG_GRID_CLASSNAME}>
                                      {group.items.map((article) => {
                                          const href = localizedPath(
                                              lang,
                                              `/articles/${encodeURIComponent(article.slug)}`,
                                          )
                                          const isLocked =
                                              article.accessPolicy === 'PAID' &&
                                              article.body === null
                                          return (
                                              <CatalogRow
                                                  key={`${group.key}-${article.id}`}
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
                                                      formatPublishedAt(
                                                          article.publishedAt,
                                                          lang,
                                                          format,
                                                      ),
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
                                                          <span className="text-xs text-muted-foreground">
                                                              {catalog.noText}
                                                          </span>
                                                      )
                                                  }
                                              />
                                          )
                                      })}
                                  </ul>
                              </div>
                          ))
                        : null}
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
