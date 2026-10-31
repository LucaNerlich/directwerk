'use client'

import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogBrowseControls from '@/components/CatalogBrowseControls'
import CatalogMediaThumb from '@/components/CatalogMediaThumb'
import CatalogRow, {LockedCatalogAction} from '@/components/CatalogRow'
import ContentMetaLine from '@/components/ContentMetaLine'
import EpisodeListenButton from '@/components/EpisodeListenButton'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import {PublicFeedStrip} from '@/components/PublicFeedFooter'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {listMyEpisodes, listPublicEpisodes, listPublicSeries} from '@/lib/api/client'
import {
    browseEpisodes,
    collectCategories,
    collectFormats,
    groupByCategory,
    hasActiveBrowse,
    toggleId,
} from '@/lib/catalog/catalogBrowse'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import type {PublicEpisode} from '@directwerk/api/types'
import {formatDuration} from '@/lib/format/content'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {webPublicPodcastFeedUrl} from '@/lib/feeds/webPublicFeedUrl'
import {formatPublishedAt} from '@/lib/format/dateTime'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {interpolate} from '@/lib/i18n/interpolate'
import {localizedPath} from '@/lib/i18n/paths'

/** Long-running shows can have hundreds of episodes; render them in chunks. */
const PAGE_SIZE = 20

export default function EpisodesClient({
    initialEpisodes,
}: {
    initialEpisodes: PublicEpisode[] | null
}): React.JSX.Element {
    const lang = useLocale()
    const {catalog, common, format: formatCopy, nav} = useDictionary()
    const tenantHost = getWebClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, series, items: episodes, errorMessage, isLoading} = usePublicCatalog({
        tenantHost,
        isAuthenticated,
        authRequiredMessage: catalog.episodeAuthRequired,
        loadErrorMessage: catalog.episodeLoadFailed,
        loadMine: listMyEpisodes,
        loadPublic: listPublicEpisodes,
        loadSeries: listPublicSeries,
        initialItems: initialEpisodes,
    })
    const products = usePublicProducts()
    const unlockTarget = unlockHref(findUnlockProduct(products), lang)
    const publicPodcastFeedUrl = webPublicPodcastFeedUrl(siteConfig, tenantHost)
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const [query, setQuery] = useState('')
    const [categoryIds, setCategoryIds] = useState<Set<number>>(() => new Set())
    const [formatIds, setFormatIds] = useState<Set<number>>(() => new Set())

    useEffect(() => {
        setVisibleCount(PAGE_SIZE)
    }, [isAuthenticated, tenantHost])

    useEffect(() => {
        setVisibleCount(PAGE_SIZE)
    }, [query, categoryIds, formatIds])

    const categoryChips = useMemo(() => collectCategories(episodes), [episodes])
    const formatChips = useMemo(() => collectFormats(episodes), [episodes])
    const browsing = hasActiveBrowse(query, categoryIds, formatIds)
    const filtered = useMemo(
        () => browseEpisodes(episodes, {query, categoryIds, formatIds}),
        [episodes, query, categoryIds, formatIds],
    )
    const featured = !browsing ? (episodes[0] ?? null) : null
    const listSource = useMemo(() => {
        if (featured === null) {
            return filtered
        }
        return filtered.filter((episode) => episode.id !== featured.id)
    }, [filtered, featured])
    const visibleItems = listSource.slice(0, visibleCount)
    const groups = useMemo(
        () => groupByCategory(visibleItems, catalog.uncategorized),
        [visibleItems, catalog.uncategorized],
    )
    const remainingAfterVisible = Math.max(0, listSource.length - visibleCount)
    const showBrowse =
        episodes.length > 1 || categoryChips.length > 0 || formatChips.length > 0
    const showGroupLabels =
        groups.length > 1 || groups.some((group) => group.key !== 'uncategorized')

    return (
        <PageStack className="page-container">
            <PageHeader
                eyebrow={catalog.episodesEyebrow}
                title={catalog.episodesTitle}
                description={
                    isAuthenticated
                        ? catalog.episodesDescAuth
                        : catalog.episodesDescGuest
                }
            />
            {publicPodcastFeedUrl !== null ? (
                <PublicFeedStrip kind="podcast" publicFeedUrl={publicPodcastFeedUrl} />
            ) : null}
            <SubscriberContextBanner showWhenAuthenticated={false} />

            {isLoading ? <ListPanelSkeleton rows={5} /> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {!isLoading && errorMessage === null ? (
                <>
                    {series.length > 0 ? (
                        <section className="flex flex-col gap-4">
                            <SectionHeader
                                description={
                                    <>
                                        {catalog.seriesDescriptionBefore}{' '}
                                        <Link
                                            className="underline-offset-4 hover:underline"
                                            href={localizedPath(lang, '/feeds')}
                                        >
                                            {nav.manageFeedsLink}
                                        </Link>
                                    </>
                                }
                                title={catalog.seriesTitle}
                            />
                            <ListPanel>
                                {series.map((item) => (
                                    <ListPanelRow key={item.id}>
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <p className="font-medium">{item.title}</p>
                                            <ContentMetaLine
                                                items={[
                                                    item.language !== null
                                                        ? item.language
                                                        : null,
                                                    item.itunesCategory !== null
                                                        ? item.itunesCategory
                                                        : null,
                                                ]}
                                            />
                                            {item.description !== null &&
                                            item.description.length > 0 ? (
                                                <p className="line-clamp-2 text-sm text-muted-foreground">
                                                    {item.description}
                                                </p>
                                            ) : null}
                                        </div>
                                    </ListPanelRow>
                                ))}
                            </ListPanel>
                        </section>
                    ) : null}

                    <section className="flex flex-col gap-4">
                        <SectionHeader
                            description={interpolate(catalog.visibleCountEpisodes, {
                                count: browsing ? filtered.length : episodes.length,
                                noun:
                                    (browsing ? filtered.length : episodes.length) === 1
                                        ? catalog.nounEpisode
                                        : catalog.nounEpisodes,
                            })}
                            title={catalog.publishedEpisodesTitle}
                        />
                        {episodes.length === 0 ? (
                            <EmptyState
                                description={
                                    isAuthenticated
                                        ? catalog.noEpisodesAuth
                                        : catalog.noEpisodesGuest
                                }
                                title={catalog.noEpisodesTitle}
                                action={
                                    !isAuthenticated ? (
                                        <Button nativeButton={false} render={<Link href={localizedPath(lang, '/login')} />}>
                                            {nav.login}
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <>
                                {showBrowse ? (
                                    <CatalogBrowseControls
                                        searchLabel={catalog.searchEpisodesLabel}
                                        searchPlaceholder={catalog.searchEpisodesPlaceholder}
                                        clearSearchLabel={catalog.clearSearch}
                                        clearFiltersLabel={catalog.clearFilters}
                                        categoriesLegend={catalog.categoriesLegend}
                                        formatsLegend={catalog.formatsLegend}
                                        hitCountLabel={
                                            browsing
                                                ? interpolate(catalog.hitCount, {
                                                      count: filtered.length,
                                                  })
                                                : null
                                        }
                                        query={query}
                                        onQueryChange={setQuery}
                                        categories={categoryChips}
                                        selectedCategoryIds={categoryIds}
                                        onToggleCategory={(id) =>
                                            setCategoryIds((prev) => toggleId(prev, id))
                                        }
                                        formats={formatChips}
                                        selectedFormatIds={formatIds}
                                        onToggleFormat={(id) =>
                                            setFormatIds((prev) => toggleId(prev, id))
                                        }
                                        onClear={() => {
                                            setQuery('')
                                            setCategoryIds(new Set())
                                            setFormatIds(new Set())
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
                                                    setFormatIds(new Set())
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
                                                href={localizedPath(lang, `/episodes/${encodeURIComponent(featured.slug)}`)}
                                            >
                                                {featured.episodeNumber !== null
                                                    ? `#${featured.episodeNumber} `
                                                    : ''}
                                                {featured.title}
                                            </Link>
                                        }
                                        description={
                                            <span className="inline-flex flex-wrap items-center gap-2">
                                                <AccessPolicyBadge
                                                    policy={featured.accessPolicy}
                                                    isEntitled={
                                                        featured.accessPolicy === 'PAID'
                                                            ? featured.audioCdnUrl !== null
                                                            : undefined
                                                    }
                                                />
                                                {featured.seriesSlug}
                                                {featured.categories.length > 0
                                                    ? featured.categories
                                                          .map((c) => c.name)
                                                          .join(', ')
                                                    : null}
                                                {featured.formats.length > 0
                                                    ? featured.formats
                                                          .map((f) => f.name)
                                                          .join(', ')
                                                    : null}
                                                {formatPublishedAt(featured.publishedAt, lang, formatCopy)}
                                                {formatDuration(featured.durationSeconds)}
                                            </span>
                                        }
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                                            <CatalogMediaThumb
                                                alt={featured.title}
                                                priority
                                                size="lg"
                                                src={featured.coverImageUrl}
                                            />
                                            <div className="flex flex-wrap gap-2">
                                                {featured.audioCdnUrl !== null ? (
                                                    <EpisodeListenButton episode={featured} />
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
                                              <ListPanel>
                                                  {group.items.map((episode) => {
                                                      const href = localizedPath(
                                                          lang,
                                                          `/episodes/${encodeURIComponent(episode.slug)}`,
                                                      )
                                                      const isLocked =
                                                          episode.accessPolicy === 'PAID' &&
                                                          episode.audioCdnUrl === null
                                                      return (
                                                          <CatalogRow
                                                              key={`${group.key}-${episode.id}`}
                                                              href={href}
                                                              title={
                                                                  <>
                                                                      {episode.episodeNumber !== null
                                                                          ? `#${episode.episodeNumber} `
                                                                          : ''}
                                                                      {episode.title}
                                                                  </>
                                                              }
                                                              imageUrl={episode.coverImageUrl}
                                                              imageAlt={episode.title}
                                                              badge={
                                                                  <AccessPolicyBadge
                                                                      policy={episode.accessPolicy}
                                                                      isEntitled={
                                                                          episode.accessPolicy ===
                                                                          'PAID'
                                                                              ? !isLocked
                                                                              : undefined
                                                                      }
                                                                  />
                                                              }
                                                              metaItems={[
                                                                  episode.seriesSlug,
                                                                  episode.categories.length > 0
                                                                      ? episode.categories
                                                                            .map((c) => c.name)
                                                                            .join(', ')
                                                                      : null,
                                                                  episode.formats.length > 0
                                                                      ? episode.formats
                                                                            .map((f) => f.name)
                                                                            .join(', ')
                                                                      : null,
                                                                  formatPublishedAt(
                                                                      episode.publishedAt,
                                                                      lang,
                                                                      formatCopy,
                                                                  ),
                                                                  formatDuration(
                                                                      episode.durationSeconds,
                                                                  ),
                                                              ]}
                                                              action={
                                                                  episode.audioCdnUrl !== null ? (
                                                                      <EpisodeListenButton
                                                                          episode={episode}
                                                                          size="sm"
                                                                          variant="outline"
                                                                      />
                                                                  ) : isLocked ? (
                                                                      <LockedCatalogAction
                                                                          isAuthenticated={
                                                                              isAuthenticated
                                                                          }
                                                                          unlockHref={unlockTarget}
                                                                      />
                                                                  ) : (
                                                                      <span className="max-w-32 text-right text-xs text-muted-foreground">
                                                                          {catalog.noAudio}
                                                                      </span>
                                                                  )
                                                              }
                                                          />
                                                      )
                                                  })}
                                              </ListPanel>
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
                                            {interpolate(common.showMore, {
                                                count: remainingAfterVisible,
                                            })}
                                        </Button>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </section>
                </>
            ) : null}
        </PageStack>
    )
}
