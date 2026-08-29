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
import ContentMetaLine from '@/components/ContentMetaLine'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {usePublicCatalog} from '@/lib/catalog/usePublicCatalog'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {accessPolicyLabel, formatDuration} from '@/lib/format/content'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {formatPublishedAt} from '@directwerk/api/format/datetime'

export default function EpisodesPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, series, episodes, errorMessage, isLoading} = usePublicCatalog({
        tenantHost,
        isAuthenticated,
    })

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
                                                    <FeedUrlDisplay url={feedUrl} />
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
                                {episodes.map((episode) => (
                                    <ListPanelRow key={episode.id}>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                className="font-medium hover:underline"
                                                href={`/episodes/${encodeURIComponent(episode.slug)}`}
                                            >
                                                {episode.episodeNumber !== null
                                                    ? `#${episode.episodeNumber} `
                                                    : ''}
                                                {episode.title}
                                            </Link>
                                            <ContentMetaLine
                                                items={[
                                                    episode.seriesSlug,
                                                    accessPolicyLabel(episode.accessPolicy),
                                                    formatPublishedAt(episode.publishedAt),
                                                    formatDuration(episode.durationSeconds),
                                                ]}
                                            />
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <AccessPolicyBadge policy={episode.accessPolicy} />
                                            {episode.audioCdnUrl !== null ? (
                                                <Button
                                                    nativeButton={false}
                                                    render={
                                                        <Link
                                                            href={`/episodes/${encodeURIComponent(episode.slug)}`}
                                                        />
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    Anhören
                                                </Button>
                                            ) : (
                                                <span className="max-w-32 text-right text-xs text-muted-foreground">
                                                    {episode.accessPolicy === 'PAID'
                                                        ? isAuthenticated
                                                            ? 'Freischaltung prüfen'
                                                            : 'Anmelden für Zugang'
                                                        : 'Kein Audio'}
                                                </span>
                                            )}
                                        </div>
                                    </ListPanelRow>
                                ))}
                            </ListPanel>
                        )}
                    </section>

                    {siteConfig?.publicRssUrl !== null &&
                    siteConfig?.publicRssUrl !== undefined ? (
                        <section className="flex flex-col gap-4">
                            <SectionHeader
                                description="Alle freien Folgen in einer Podcast-App abonnieren."
                                title="Gesamt-Feed"
                            />
                            <FeedUrlDisplay
                                title="Öffentlicher Feed"
                                url={siteConfig.publicRssUrl}
                            />
                        </section>
                    ) : null}
                </>
            ) : null}
        </PageStack>
    )
}
