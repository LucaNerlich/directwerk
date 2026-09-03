'use client'

import Link from 'next/link'
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

function QueueSkeleton(): React.JSX.Element {
    return (
        <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4" role="status">
            <span className="sr-only">Aktuelle Entwürfe werden geladen…</span>
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
                        : 'Übersicht konnte nicht geladen werden.',
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
    }, [authRedirect, attempt, router, showPodcast, showWrite])

    if (!showWrite && !showPodcast) {
        return <></>
    }

    if (isLoading) {
        return (
            <section aria-label="Als Nächstes" className="flex flex-col gap-6">
                <SectionHeader
                    description="Entwürfe und geplante Inhalte, die als Nächstes dran sind."
                    title="Als Nächstes"
                />
                <QueueSkeleton />
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
        <section aria-label="Als Nächstes" className="flex flex-col gap-6">
            <SectionHeader
                description="Entwürfe und geplante Inhalte, die als Nächstes dran sind."
                title="Als Nächstes"
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
                        Erneut laden
                    </Button>
                </Alert>
            ) : null}

            {hasQueuedItems ? (
                <div className="grid gap-4 sm:grid-cols-3">
                    {showWrite ? (
                        <StatCard
                            label="Beitrags-Entwürfe"
                            value={awaitingArticles.length}
                            hint={
                                awaitingArticles.length === 0
                                    ? 'Keine offenen Beiträge'
                                    : 'Entwürfe und geplante Beiträge'
                            }
                        />
                    ) : null}
                    {showPodcast ? (
                        <StatCard
                            label="Folgen-Entwürfe"
                            value={awaitingEpisodes.length}
                            hint={
                                awaitingEpisodes.length === 0
                                    ? 'Keine offenen Folgen'
                                    : 'Entwürfe und geplante Folgen'
                            }
                        />
                    ) : null}
                    {showPodcast ? (
                        <StatCard
                            label="Sendungen im Entwurf"
                            value={draftSeries.length}
                            hint={
                                draftSeries.length === 0
                                    ? 'Alle Sendungen veröffentlicht'
                                    : 'Noch zu veröffentlichen'
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
                    title="Noch keine Sendung"
                    description="Lege zuerst eine Sendung an — danach kannst du die erste Folge erstellen."
                    action={
                        <Link className="underline" href="/podcast/series/new">
                            Erste Sendung anlegen
                        </Link>
                    }
                />
            ) : null}

            {showPodcast && series.length > 0 && episodes.length === 0 ? (
                <EmptyState
                    title="Noch keine Folge"
                    description="Deine Sendung steht. Jetzt fehlt nur noch die erste Folge."
                    action={
                        <Link className="underline" href="/podcast/episodes/new">
                            Erste Folge anlegen
                        </Link>
                    }
                />
            ) : null}

            {showWrite && articles.length === 0 ? (
                <EmptyState
                    title="Noch kein Beitrag"
                    description="Schreibe deinen ersten Beitrag — er landet automatisch hier als Entwurf."
                    action={
                        <Link className="underline" href="/write/articles/new">
                            Ersten Beitrag schreiben
                        </Link>
                    }
                />
            ) : null}

            {!hasQueuedItems && !showFirstRunGuidance && errorMessage === null ? (
                <EmptyState
                    title="Alles erledigt"
                    description="Keine Entwürfe oder geplanten Inhalte. Lege etwas Neues an, wenn du bereit bist."
                />
            ) : null}

            {draftSeries.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title="Sendungen zum Veröffentlichen" />
                    <EntityListView
                        ariaLabel="Sendungen zum Veröffentlichen"
                        items={draftItems(draftSeries, '/podcast/series')}
                        linkComponent={Link}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}

            {awaitingEpisodes.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title="Folgen-Entwürfe" />
                    <EntityListView
                        ariaLabel="Folgen-Entwürfe"
                        items={draftItems(awaitingEpisodes, '/podcast/episodes')}
                        linkComponent={Link}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}

            {awaitingArticles.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <SectionHeader as="h3" title="Beitrags-Entwürfe" />
                    <EntityListView
                        ariaLabel="Beitrags-Entwürfe"
                        items={draftItems(awaitingArticles, '/write/articles')}
                        linkComponent={Link}
                        viewMode={viewMode}
                    />
                </div>
            ) : null}
        </section>
    )
}
