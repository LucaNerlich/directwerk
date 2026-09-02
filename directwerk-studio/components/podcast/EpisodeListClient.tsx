'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationListSection from '@/components/publication/PublicationListSection'
import BulkEditDialog, {type BulkEditOperation} from '@/components/publication/BulkEditDialog'
import {
    listCategories,
    listFormats,
    replaceEpisodeCategories,
    replaceEpisodeFormats,
} from '@/lib/api/catalogApi'
import {
    cancelScheduleEpisode,
    listEpisodes,
    listSeries,
    publishEpisode,
    unarchiveEpisode,
    unpublishEpisode,
    updateEpisode,
} from '@/lib/api/podcastApi'
import type {
    CategorySummary,
    EpisodeDetail,
    FormatSummary,
    SeriesSummary,
} from '@directwerk/api/types'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
import {usePublicationListPage} from '@/lib/publication/usePublicationListPage'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function EpisodeListClient() {
    const authRedirect = useAuthRequired()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [prereqError, setPrereqError] = useState<string | null>(null)
    const [prereqLoading, setPrereqLoading] = useState(true)

    const loadPrerequisites = useCallback(async (): Promise<void> => {
        try {
            const host = getClientTenantHost()
            const [loadedSeries, loadedFormats, loadedCategories] = await Promise.all([
                listSeries(host),
                listFormats(host),
                listCategories(host).catch(() => []),
            ])
            setSeries(loadedSeries)
            setFormats(loadedFormats)
            setCategories(loadedCategories)
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

    const seriesStatusById = useMemo(
        () => new Map(series.map((item) => [item.id, item.status])),
        [series],
    )
    const publishBlockedReason = useCallback(
        (episode: EpisodeDetail): string | null =>
            seriesStatusById.get(episode.seriesId) === 'PUBLISHED'
                ? null
                : 'Die Sendung muss zuerst veröffentlicht werden.',
        [seriesStatusById],
    )
    const isBulkPublishEligible = useCallback(
        (episode: EpisodeDetail): boolean =>
            seriesStatusById.get(episode.seriesId) === 'PUBLISHED',
        [seriesStatusById],
    )
    const isBulkUnpublishEligible = useCallback(
        (episode: EpisodeDetail): boolean => episode.status === 'PUBLISHED',
        [],
    )

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
        runBulkEdit,
    } = usePublicationListPage<EpisodeDetail>({
        load: () => listEpisodes(getClientTenantHost()),
        publish: (id) => publishEpisode(getClientTenantHost(), id),
        unpublish: (id) => unpublishEpisode(getClientTenantHost(), id),
        cancelSchedule: (id) => cancelScheduleEpisode(getClientTenantHost(), id),
        unarchive: (id) => unarchiveEpisode(getClientTenantHost(), id),
        isBulkPublishEligible,
        isBulkUnpublishEligible,
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

    const seriesTitleById = useMemo(
        () => new Map(series.map((item) => [item.id, item.title])),
        [series],
    )
    const listItems = useMemo(
        () =>
            episodes.map((episode) => ({
                ...episode,
                seriesLabel: seriesTitleById.get(episode.seriesId) ?? null,
            })),
        [episodes, seriesTitleById],
    )

    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
    const draftCount = useMemo(
        () =>
            episodes.filter(
                (episode) => selectedIds.has(episode.id) && episode.status === 'DRAFT',
            ).length,
        [episodes, selectedIds],
    )

    const handleBulkEditApply = useCallback(
        async (operation: BulkEditOperation): Promise<void> => {
            const eligible = episodes.filter(
                (episode) => selectedIds.has(episode.id) && episode.status === 'DRAFT',
            )
            if (eligible.length === 0) {
                return
            }
            const host = getClientTenantHost()
            const apply = (id: number): Promise<EpisodeDetail> => {
                if (operation.kind === 'formats') {
                    return replaceEpisodeFormats(host, id, operation.formatIds)
                }
                if (operation.kind === 'categories') {
                    return replaceEpisodeCategories(host, id, operation.categoryIds)
                }
                return updateEpisode(host, id, {accessPolicy: operation.accessPolicy})
            }
            await runBulkEdit(
                eligible,
                apply,
                (count) =>
                    count === 1
                        ? '1 Folge aktualisiert.'
                        : `${count} Folgen aktualisiert.`,
                (successCount, failureCount) =>
                    `${successCount} von ${successCount + failureCount} Folgen aktualisiert.`,
                'Folgen konnten nicht aktualisiert werden.',
            )
            setIsBulkEditOpen(false)
        },
        [episodes, runBulkEdit, selectedIds],
    )

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
                        items={listItems}
                        onBulkEdit={() => setIsBulkEditOpen(true)}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onCancelSchedule={(episode) => void handleCancelSchedule(episode)}
                        onPublish={(episode) => void handlePublish(episode)}
                        onToggleSelectAll={toggleSelectAll}
                        onToggleSelection={toggleSelection}
                        onUnarchive={(episode) => void handleUnarchive(episode)}
                        onUnpublish={(episode) => void handleUnpublish(episode)}
                        onViewModeChange={setViewMode}
                        publishBlockedReason={publishBlockedReason}
                        publishableCount={publishableCount}
                        selectedIds={selectedIds}
                        unpublishableCount={unpublishableCount}
                        viewMode={viewMode}
                    />
                    <BulkEditDialog
                        busy={isBulkBusy}
                        categories={categories}
                        contentLabel="Folge"
                        draftCount={draftCount}
                        formats={formats}
                        onApply={(operation) => void handleBulkEditApply(operation)}
                        onOpenChange={setIsBulkEditOpen}
                        open={isBulkEditOpen}
                        selectedCount={selectedIds.size}
                    />
                </>
            ) : null}
        </div>
    )
}
