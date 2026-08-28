'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listFormats} from '@/lib/api/catalogApi'
import {cancelScheduleEpisode, listEpisodes, listSeries, unarchiveEpisode, unpublishEpisode} from '@/lib/api/podcastApi'
import type {EpisodeDetail, FormatSummary, SeriesSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function EpisodeListClient() {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [episodes, setEpisodes] = useState<EpisodeDetail[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyEpisodeId, setBusyEpisodeId] = useState<number | null>(null)

    const load = useCallback(async (): Promise<void> => {
        try {
            const host = getClientTenantHost()
            const [loadedEpisodes, loadedSeries, loadedFormats] = await Promise.all([
                listEpisodes(host),
                listSeries(host),
                listFormats(host),
            ])
            setEpisodes(loadedEpisodes)
            setSeries(loadedSeries)
            setFormats(loadedFormats)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Folgen konnten nicht geladen werden.',
            )
        } finally {
            setIsLoading(false)
        }
    }, [authRedirect])

    useEffect(() => {
        void load()
    }, [load])

    const handleUnpublish = async (episode: EpisodeDetail): Promise<void> => {
        setBusyEpisodeId(episode.id)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const updated = await unpublishEpisode(getClientTenantHost(), episode.id)
            setEpisodes((current) =>
                current.map((item) => (item.id === episode.id ? updated : item)),
            )
            setStatusMessage(`Folge „${episode.title}“ wurde zurückgezogen (Entwurf).`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Folge konnte nicht zurückgezogen werden.',
            )
        } finally {
            setBusyEpisodeId(null)
        }
    }

    const handleCancelSchedule = async (episode: EpisodeDetail): Promise<void> => {
        setBusyEpisodeId(episode.id)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const updated = await cancelScheduleEpisode(getClientTenantHost(), episode.id)
            setEpisodes((current) =>
                current.map((item) => (item.id === episode.id ? updated : item)),
            )
            setStatusMessage(`Planung für „${episode.title}“ wurde aufgehoben (Entwurf).`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Planung konnte nicht aufgehoben werden.',
            )
        } finally {
            setBusyEpisodeId(null)
        }
    }

    const handleUnarchive = async (episode: EpisodeDetail): Promise<void> => {
        setBusyEpisodeId(episode.id)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const updated = await unarchiveEpisode(getClientTenantHost(), episode.id)
            setEpisodes((current) =>
                current.map((item) => (item.id === episode.id ? updated : item)),
            )
            setStatusMessage(`Folge „${episode.title}“ wurde wiederhergestellt (Entwurf).`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Folge konnte nicht wiederhergestellt werden.',
            )
        } finally {
            setBusyEpisodeId(null)
        }
    }

    if (isLoading) {
        return <p>Folgen werden geladen…</p>
    }

    const hasSeries = series.length > 0
    const canCreate = hasSeries

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Podcast · Erstellen"
                title="Folgen"
                description="Hier entsteht dein laufender Output: Audio, Shownotes, Format, Veröffentlichen."
                actions={
                    canCreate ? (
                        <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />} size="lg">
                            Neue Folge
                        </Button>
                    ) : null
                }
            />

            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}
            {statusMessage !== null && (
                <p className="text-sm text-muted-foreground" role="status">
                    {statusMessage}
                </p>
            )}

            {!hasSeries ? (
                <EmptyState
                    title="Zuerst eine Sendung anlegen"
                    description="Eine Folge gehört zu einer Sendung. Richte die Sendung einmal ein — danach kannst du regelmäßig Folgen veröffentlichen."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/series/new" />}>
                            Sendung anlegen
                        </Button>
                    }
                />
            ) : null}

            {hasSeries && formats.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    Noch keine Formate.{' '}
                    <Link href="/podcast/formats/new">Formate anlegen</Link>
                    {' '}
                    (empfohlen), damit du Folgen als Hauptfolge, Bonus usw. kennzeichnen kannst.
                </div>
            ) : null}

            {hasSeries && episodes.length === 0 ? (
                <EmptyState
                    title="Noch keine Folgen"
                    description="Lade Audio hoch, schreibe Shownotes und veröffentliche deine erste Folge."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />}>
                            Erste Folge anlegen
                        </Button>
                    }
                />
            ) : null}

            {episodes.length > 0 ? (
                <ListPanel>
                    {episodes.map((episode) => {
                        const isBusy = busyEpisodeId === episode.id
                        return (
                            <ListPanelRow key={episode.id}>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        className="font-medium hover:underline"
                                        href={`/podcast/episodes/${episode.id}`}
                                    >
                                        {episode.title}
                                    </Link>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <PublicationStatusBadge status={episode.status} />
                                    {episode.status === 'PUBLISHED' && (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() => void handleUnpublish(episode)}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            {isBusy ? 'Wird zurückgezogen…' : 'Zurückziehen'}
                                        </Button>
                                    )}
                                    {episode.status === 'SCHEDULED' && (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() => void handleCancelSchedule(episode)}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            {isBusy ? 'Wird abgebrochen…' : 'Planung aufheben'}
                                        </Button>
                                    )}
                                    {episode.status === 'ARCHIVED' && (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() => void handleUnarchive(episode)}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            {isBusy ? 'Wird wiederhergestellt…' : 'Wiederherstellen'}
                                        </Button>
                                    )}
                                </div>
                            </ListPanelRow>
                        )
                    })}
                </ListPanel>
            ) : null}
        </div>
    )
}
