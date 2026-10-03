'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListToolbar} from '@directwerk/ui/components/entity-list-toolbar'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import StatCard from '@directwerk/ui/components/stat-card'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listEpisodes, listSeries} from '@/lib/api/podcastApi'
import {listArticles} from '@/lib/api/writeApi'
import type {
    ArticleSummary,
    EpisodeSummary,
    PublicationStatus,
    SeriesSummary,
    StudioDesk,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const AWAITING_STATUSES = new Set(['DRAFT', 'SCHEDULED'])

interface OverviewQueueProps {
    desks: StudioDesk[]
}

function draftItems(
    items: {id: number; title: string; status: PublicationStatus}[],
    editorBasePath: string,
): EntityListViewItem<number>[] {
    return items.map((item) => ({
        id: item.id,
        title: item.title,
        href: `${editorBasePath}/${item.id}`,
        trailing: <PublicationStatusBadge status={item.status} />,
    }))
}

function QueueSkeleton({loadingLabel}: {loadingLabel: string}): React.JSX.Element {
    return (
        <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4" role="status">
            <span className="sr-only">{loadingLabel}</span>
            <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-12" aria-hidden="true" />
            <Skeleton className="h-12" aria-hidden="true" />
        </div>
    )
}

export default function OverviewQueue({desks}: OverviewQueueProps): React.JSX.Element {
    const router = useRouter()
    const dict = useDictionary()
    const home = dict.shell.home
    const authRedirect = useAuthRequired()
    const showWrite = desks.includes('WRITE')
    const showPodcast = desks.includes('PODCAST')
    const [episodes, setEpisodes] = useState<EpisodeSummary[]>([])
    const [articles, setArticles] = useState<ArticleSummary[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(showWrite || showPodcast)
    const [attempt, setAttempt] = useState(0)
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        if (!showWrite && !showPodcast) {
            return
        }

        let active = true

        async function load(): Promise<void> {
            setErrorMessage(null)
            setIsLoading(true)
            try {
                const host = getClientTenantHost()
                const [loadedArticles, loadedEpisodes, loadedSeries] = await Promise.all([
                    showWrite ? listArticles(host) : Promise.resolve([]),
                    showPodcast ? listEpisodes(host) : Promise.resolve([]),
                    showPodcast ? listSeries(host) : Promise.resolve([]),
                ])
                if (!active) {
                    return
                }
                setArticles(loadedArticles)
                setEpisodes(loadedEpisodes)
                setSeries(loadedSeries)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : home.overviewLoadFailed,
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [authRedirect, attempt, home.overviewLoadFailed, router, showPodcast, showWrite])

    if (!showWrite && !showPodcast) {
        return <></>
    }

    if (isLoading) {
        return (
            <section aria-label={home.upNext} className="flex flex-col gap-6">
                <SectionHeader
                    description={home.upNextDescription}
                    title={home.upNext}
                />
                <QueueSkeleton loadingLabel={home.draftsLoading} />
            </section>
        )
    }

    const awaitingArticles = articles.filter((item) => AWAITING_STATUSES.has(item.status))
    const awaitingEpisodes = episodes.filter((item) => AWAITING_STATUSES.has(item.status))
    const draftSeries = series.filter((item) => item.status === 'DRAFT')
    const hasQueuedItems =
        draftSeries.length + awaitingEpisodes.length + awaitingArticles.length > 0
    const showSeriesGuidance = showPodcast && series.length === 0
    const showEpisodeGuidance =
        showPodcast && series.length > 0 && episodes.length === 0
    const showArticleGuidance = showWrite && articles.length === 0
    const showFirstRunGuidance =
        showSeriesGuidance || showEpisodeGuidance || showArticleGuidance

    return (
        <section aria-label={home.upNext} className="flex flex-col gap-6">
            <SectionHeader
                description={home.upNextDescription}
                title={home.upNext}
            />
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => {
                            setAttempt((value) => value + 1)
                        }}
                        type="button"
                        variant="outline"
                    >
                        {dict.common.retry}
                    </Button>
                </Alert>
            ) : null}

            {hasQueuedItems ? (
                <div className="grid gap-4 sm:grid-cols-3">
                    {showWrite ? (
                        <StatCard
                            label={home.articleDrafts}
                            value={awaitingArticles.length}
                            hint={
                                awaitingArticles.length === 0
                                    ? home.noOpenArticles
                                    : home.draftScheduledArticles
                            }
                        />
                    ) : null}
                    {showPodcast ? (
                        <StatCard
                            label={home.episodeDrafts}
                            value={awaitingEpisodes.length}
                            hint={
                                awaitingEpisodes.length === 0
                                    ? home.noOpenEpisodes
                                    : home.draftScheduledEpisodes
                            }
                        />
                    ) : null}
                    {showPodcast ? (
                        <StatCard
                            label={home.showsInDraft}
                            value={draftSeries.length}
                            hint={
                                draftSeries.length === 0
                                    ? home.allShowsPublished
                                    : home.stillToPublish
                            }
                        />
                    ) : null}
                </div>
            ) : null}

            {hasQueuedItems ? (
                <EntityListToolbar
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
            ) : null}

            {showPodcast && series.length === 0 ? (
                <EmptyState
                    title={dict.podcast.emptyShowsTitle}
                    description={home.createShowFirst}
                    action={
                        <LocaleLink className="underline" href="/podcast/series/new">
                            Erste Sendung anlegen
                        </LocaleLink>
                    }
                />
            ) : null}

            {showPodcast && series.length > 0 && episodes.length === 0 ? (
                <EmptyState
                    title={home.noEpisodeYet}
                    description={home.showReadyNeedEpisode}
                    action={
                        <LocaleLink className="underline" href="/podcast/episodes/new">
                            Erste Folge anlegen
                        </LocaleLink>
                    }
                />
            ) : null}

            {showWrite && articles.length === 0 ? (
                <EmptyState
                    title={dict.write.noArticleYet}
                    description={home.writeFirstArticle}
                    action={
                        <LocaleLink className="underline" href="/write/articles/new">
                            Ersten Beitrag schreiben
                        </LocaleLink>
                    }
                />
            ) : null}

            {!hasQueuedItems && !showFirstRunGuidance && errorMessage === null ? (
                <EmptyState
                    title="Alles erledigt"
                    description={home.noDraftsEmpty}
                />
            ) : null}

            {draftSeries.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title={home.showsToPublish} />
                    <EntityListView
                        ariaLabel={home.showsToPublish}
                        items={draftItems(draftSeries, '/podcast/series')}
                        linkComponent={LocaleLink}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}

            {awaitingEpisodes.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title={home.episodeDrafts} />
                    <EntityListView
                        ariaLabel={home.episodeDrafts}
                        items={draftItems(awaitingEpisodes, '/podcast/episodes')}
                        linkComponent={LocaleLink}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}

            {awaitingArticles.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title={home.articleDrafts} />
                    <EntityListView
                        ariaLabel={home.articleDrafts}
                        items={draftItems(awaitingArticles, '/write/articles')}
                        linkComponent={LocaleLink}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}
        </section>
    )
}
