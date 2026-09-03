'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogRow, {LockedCatalogAction} from '@/components/CatalogRow'
import ContentMetaLine from '@/components/ContentMetaLine'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import PublicFeedFooter, {PublicFeedStrip} from '@/components/PublicFeedFooter'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useSubscriberFeeds} from '@/lib/auth/useSubscriberFeeds'
import {formatDuration} from '@/lib/format/content'
import {getClientTenantHost} from '@/lib/tenant/clientHost'
import {webPublicPodcastFeedUrl} from '@/lib/feeds/webPublicFeedUrl'
import {formatPublishedAt} from '@directwerk/api/format/datetime'

export default function EpisodesPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, series, episodes, errorMessage, isLoading} = usePublicCatalog({
        tenantHost,
        isAuthenticated,
    })
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products))
    const {feeds: privateFeeds} = useSubscriberFeeds(isAuthenticated)
    const defaultPrivateFeed = privateFeeds.find((feed) => feed.isDefault) ?? null
    const publicPodcastFeedUrl =
        siteConfig === null ? null : webPublicPodcastFeedUrl(siteConfig, tenantHost)

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Folgen"
                description={
                    isAuthenticated
                        ? 'Angemeldet: freie und für dich freigeschaltete Folgen.'
                        : 'Öffentlich: nur freie Folgen. Anmelden für bezahlte Inhalte.'
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
                                description="Sendungen und ihre öffentlichen RSS-Feeds."
                                title="Sendungen"
                            />
                            <ListPanel>
                                {series.map((item) => {
                                    const feedUrl = item.rssUrl
                                    return (
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
                                                {feedUrl !== null ? (
                                                    <div className="min-w-0">
                                                        <FeedUrlDisplay url={feedUrl} />
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-muted-foreground">
                                                        Kein öffentlicher Feed für diese Sendung.
                                                    </p>
                                                )}
                                            </div>
                                        </ListPanelRow>
                                    )
                                })}
                            </ListPanel>
                        </section>
                    ) : null}

                    <section className="flex flex-col gap-4">
                        <SectionHeader
                            description={`${episodes.length} ${episodes.length === 1 ? 'Folge' : 'Folgen'} sichtbar.`}
                            title="Veröffentlichte Folgen"
                        />
                        {episodes.length === 0 ? (
                            <EmptyState
                                description={
                                    isAuthenticated
                                        ? 'Keine veröffentlichten Folgen, auf die du Zugriff hast.'
                                        : 'Noch keine veröffentlichten Folgen.'
                                }
                                title="Keine Folgen"
                                action={
                                    !isAuthenticated ? (
                                        <Button nativeButton={false} render={<Link href="/login" />}>
                                            Anmelden
                                        </Button>
                                    ) : undefined
                                }
                            />
                        ) : (
                            <ListPanel>
                                {episodes.map((episode) => {
                                    const href = `/episodes/${encodeURIComponent(episode.slug)}`
                                    const isLocked =
                                        episode.accessPolicy === 'PAID' &&
                                        episode.audioCdnUrl === null
                                    return (
                                        <CatalogRow
                                            key={episode.id}
                                            href={href}
                                            title={
                                                <>
                                                    {episode.episodeNumber !== null
                                                        ? `#${episode.episodeNumber} `
                                                        : ''}
                                                    {episode.title}
                                                </>
                                            }
                                            badge={
                                                <AccessPolicyBadge
                                                    policy={episode.accessPolicy}
                                                    isEntitled={
                                                        episode.accessPolicy === 'PAID'
                                                            ? !isLocked
                                                            : undefined
                                                    }
                                                />
                                            }
                                            metaItems={[
                                                episode.seriesSlug,
                                                formatPublishedAt(episode.publishedAt),
                                                formatDuration(episode.durationSeconds),
                                            ]}
                                            action={
                                                episode.audioCdnUrl !== null ? (
                                                    <Button
                                                        nativeButton={false}
                                                        render={<Link href={href} />}
                                                        size="sm"
                                                        variant="outline"
                                                    >
                                                        Anhören
                                                    </Button>
                                                ) : isLocked ? (
                                                    <LockedCatalogAction
                                                        isAuthenticated={isAuthenticated}
                                                        unlockHref={unlockTarget}
                                                    />
                                                ) : (
                                                    <span className="max-w-32 text-right text-xs text-muted-foreground">
                                                        Kein Audio
                                                    </span>
                                                )
                                            }
                                        />
                                    )
                                })}
                            </ListPanel>
                        )}
                    </section>

                    <PublicFeedFooter
                        kind="podcast"
                        publicFeedUrl={publicPodcastFeedUrl}
                        privateFeedUrl={
                            defaultPrivateFeed !== null && defaultPrivateFeed.enabled
                                ? defaultPrivateFeed.url
                                : null
                        }
                        isAuthenticated={isAuthenticated}
                    />
                </>
            ) : null}
        </PageStack>
    )
}
