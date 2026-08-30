'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationListSection from '@/components/publication/PublicationListSection'
import {listFormats} from '@/lib/api/catalogApi'
import {
    cancelScheduleEpisode,
    listEpisodes,
    listSeries,
    publishEpisode,
    unarchiveEpisode,
    unpublishEpisode,
} from '@/lib/api/podcastApi'
import type {EpisodeDetail, FormatSummary, SeriesSummary} from '@directwerk/api/types'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
import {usePublicationListPage} from '@/lib/publication/usePublicationListPage'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

/**
 * Displays the podcast episode list and provides publication management actions.
 */
export default function EpisodeListClient() {
    const authRedirect = useAuthRequired()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [prereqError, setPrereqError] = useState<string | null>(null)
    const [prereqLoading, setPrereqLoading] = useState(true)

    const loadPrerequisites = useCallback(async (): Promise<void> => {
        try {
            const host = getClientTenantHost()
            const [loadedSeries, loadedFormats] = await Promise.all([
                listSeries(host),
                listFormats(host),
            ])
            setSeries(loadedSeries)
            setFormats(loadedFormats)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setPrereqError(
                error instanceof Error ? error.message : 'Folgen konnten nicht geladen werden.',
            )
        } finally {
            setPrereqLoading(false)
        }
    }, [authRedirect])

    useEffect(() => {
        void loadPrerequisites()
    }, [loadPrerequisites])

    const {
        items: episodes,
        isLoading: episodesLoading,
        displayError: episodeError,
        statusMessage,
        busyItemId: busyEpisodeId,
        isBulkBusy,
        selectedIds,
        allSelected,
        viewMode,
        setViewMode,
        toggleSelection,
        toggleSelectAll,
        publishableCount,
        unpublishableCount,
        handlePublish,
        handleUnpublish,
        handleCancelSchedule,
        handleUnarchive,
        handleBulkPublish,
        handleBulkUnpublish,
    } = usePublicationListPage<EpisodeDetail>({
        load: () => listEpisodes(getClientTenantHost()),
        publish: (id) => publishEpisode(getClientTenantHost(), id),
        unpublish: (id) => unpublishEpisode(getClientTenantHost(), id),
        cancelSchedule: (id) => cancelScheduleEpisode(getClientTenantHost(), id),
        unarchive: (id) => unarchiveEpisode(getClientTenantHost(), id),
        labels: {
            loadError: 'Folgen konnten nicht geladen werden.',
            publishSuccess: (title) => `Folge „${title}“ wurde veröffentlicht.`,
            unpublishSuccess: (title) =>
                `Folge „${title}“ wurde zurückgezogen (Entwurf).`,
            cancelScheduleSuccess: (title) =>
                `Planung für „${title}“ wurde aufgehoben (Entwurf).`,
            unarchiveSuccess: (title) =>
                `Folge „${title}“ wurde wiederhergestellt (Entwurf).`,
            publishError: 'Folge konnte nicht veröffentlicht werden.',
            unpublishError: 'Folge konnte nicht zurückgezogen werden.',
            cancelScheduleError: 'Planung konnte nicht aufgehoben werden.',
            unarchiveError: 'Folge konnte nicht wiederhergestellt werden.',
            bulk: createPublicationBulkLabels('Folge', 'Folgen'),
        },
    })

    const isLoading = prereqLoading || episodesLoading
    const displayError = prereqError ?? episodeError

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
                        <div className="flex flex-wrap gap-2">
                            <Button nativeButton={false} render={<Link href="/podcast/import" />} size="lg" variant="outline">
                                RSS importieren
                            </Button>
                            <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />} size="lg">
                                Neue Folge
                            </Button>
                        </div>
                    ) : null
                }
            />

            {displayError !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {displayError}
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
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        busyItemId={busyEpisodeId}
                        contentLabelPlural="Folgen"
                        editorBasePath="/podcast/episodes"
                        isBulkBusy={isBulkBusy}
                        items={episodes}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onCancelSchedule={(episode) => void handleCancelSchedule(episode)}
                        onPublish={(episode) => void handlePublish(episode)}
                        onToggleSelectAll={toggleSelectAll}
                        onToggleSelection={toggleSelection}
                        onUnarchive={(episode) => void handleUnarchive(episode)}
                        onUnpublish={(episode) => void handleUnpublish(episode)}
                        onViewModeChange={setViewMode}
                        publishableCount={publishableCount}
                        selectedIds={selectedIds}
                        unpublishableCount={unpublishableCount}
                        viewMode={viewMode}
                    />
                </>
            ) : null}
        </div>
    )
}
