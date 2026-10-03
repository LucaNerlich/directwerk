'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import PublicationListSection from '@/components/publication/PublicationListSection'
import BulkEditDialog, {type BulkEditOperation} from '@/components/publication/BulkEditDialog'
import BulkDeletePublicationDialog from '@/components/publication/BulkDeletePublicationDialog'
import DeletePublicationDialog from '@/components/publication/DeletePublicationDialog'
import {
    listCategories,
    listFormats,
    replaceEpisodeCategories,
    replaceEpisodeFormats,
} from '@/lib/api/catalogApi'
import {
    bulkDeleteEpisodes,
    bulkPublishEpisodes,
    bulkUnpublishEpisodes,
    cancelScheduleEpisode,
    deleteEpisode,
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
import {settledBulkResult} from '@/lib/publication/usePublicationBulkActions'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function EpisodeListClient() {
    const dict = useDictionary()
    const p = dict.podcast
    const authRedirect = useAuthRequired()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [prereqError, setPrereqError] = useState<string | null>(null)
    const [prereqLoading, setPrereqLoading] = useState(true)

    const loadPrerequisites = useCallback(async (): Promise<void> => {
        setPrereqLoading(true)
        setPrereqError(null)
        try {
            const host = getClientTenantHost()
            const [loadedSeries, loadedFormats, loadedCategories] = await Promise.all([
                listSeries(host),
                listFormats(host),
                listCategories(host).catch((error: unknown) => {
                    if (authRedirect(error)) {
                        throw error
                    }
                    return []
                }),
            ])
            setSeries(loadedSeries)
            setFormats(loadedFormats)
            setCategories(loadedCategories)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setPrereqError(
                error instanceof Error ? error.message : p.episodesLoadFailed,
            )
        } finally {
            setPrereqLoading(false)
        }
    }, [authRedirect, p.episodesLoadFailed])

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
                : p.seriesMustPublishFirst,
        [p.seriesMustPublishFirst, seriesStatusById],
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
        reload: reloadEpisodes,
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
        handleDelete,
        handleBulkPublish,
        handleBulkUnpublish,
        handleBulkDelete,
        runBulkEdit,
    } = usePublicationListPage<EpisodeDetail>({
        load: () => listEpisodes(getClientTenantHost()),
        publish: (id) => publishEpisode(getClientTenantHost(), id),
        unpublish: (id) => unpublishEpisode(getClientTenantHost(), id),
        cancelSchedule: (id) => cancelScheduleEpisode(getClientTenantHost(), id),
        unarchive: (id) => unarchiveEpisode(getClientTenantHost(), id),
        remove: (id) => deleteEpisode(getClientTenantHost(), id),
        publishMany: (ids) => settledBulkResult(bulkPublishEpisodes(getClientTenantHost(), {ids})),
        unpublishMany: (ids) => settledBulkResult(bulkUnpublishEpisodes(getClientTenantHost(), ids)),
        removeMany: (ids) => bulkDeleteEpisodes(getClientTenantHost(), ids),
        isBulkPublishEligible,
        isBulkUnpublishEligible,
        labels: {
            loadError: p.episodesLoadFailed,
            publishSuccess: (title) => t(p.folgeVeroeffentlicht, {title}),
            unpublishSuccess: (title) => t(p.folgeZurueckgezogenEntwurf, {title}),
            cancelScheduleSuccess: (title) => t(dict.write.scheduleCancelledToast, {title}),
            unarchiveSuccess: (title) => t(p.folgeWiederhergestelltEntwurf, {title}),
            publishError: p.folgeKonnteVeroeffentlicht,
            unpublishError: p.folgeKonnteZurueckgezogen,
            cancelScheduleError: dict.write.scheduleCancelFailed,
            unarchiveError: p.folgeKonnteWiederhergestellt,
            deleteSuccess: (title) => t(p.folgeGeloescht, {title}),
            deleteError: p.folgeKonnteGeloescht,
            bulk: createPublicationBulkLabels(p.episodeSingular, p.episodePlural),
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
    const [deleteTarget, setDeleteTarget] = useState<EpisodeDetail | null>(null)
    const [deletePending, setDeletePending] = useState(false)
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
    const [bulkDeletePending, setBulkDeletePending] = useState(false)

    const handleDeleteConfirm = useCallback(async (): Promise<void> => {
        if (deleteTarget === null || handleDelete === null) {
            return
        }
        const targetId = deleteTarget.id
        setDeletePending(true)
        try {
            await handleDelete(deleteTarget)
        } finally {
            setDeletePending(false)
            // Only close our own dialog: the user may have opened another
            // item's dialog while this delete was still pending.
            setDeleteTarget((current) =>
                current !== null && current.id === targetId ? null : current,
            )
        }
    }, [deleteTarget, handleDelete])
    const bulkDeleteItems = useMemo(
        () => episodes.filter((episode) => selectedIds.has(episode.id)),
        [episodes, selectedIds],
    )
    const handleBulkDeleteConfirm = useCallback(async (): Promise<void> => {
        if (handleBulkDelete === null) {
            return
        }
        setBulkDeletePending(true)
        try {
            await handleBulkDelete()
        } finally {
            setBulkDeletePending(false)
            setIsBulkDeleteOpen(false)
        }
    }, [handleBulkDelete])
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
                        ? p['1FolgeAktualisiert']
                        : t(p.folgenAktualisiert, {count}),
                (successCount, failureCount) =>
                    t(p.folgenAktualisiert2, {
                        successCount,
                        total: successCount + failureCount,
                    }),
                p.folgenKonntenAktualisiert,
            )
            setIsBulkEditOpen(false)
        },
        [episodes, p, runBulkEdit, selectedIds],
    )

    const isLoading = prereqLoading || episodesLoading
    const displayError = prereqError ?? episodeError

    function handleRetry(): void {
        setPrereqError(null)
        void loadPrerequisites()
        void reloadEpisodes()
    }

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {p.episodesLoading}
            </p>
        )
    }

    const hasSeries = series.length > 0
    const canCreate = hasSeries

    return (
        <PageStack className="gap-6">
            <PageHeader
                eyebrow={p.createTitle}
                title={p.episodesTitle}
                description={p.createDescription}
                actions={
                    canCreate ? (
                        <div className="flex flex-wrap gap-2">
                            <Button nativeButton={false} render={<LocaleLink href="/podcast/import" />} size="lg" variant="outline">
                                {p.importRss}
                            </Button>
                            <Button nativeButton={false} render={<LocaleLink href="/podcast/episodes/new" />} size="lg">
                                {p.newEpisode}
                            </Button>
                        </div>
                    ) : null
                }
            />

            {displayError !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{displayError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={handleRetry}
                        type="button"
                        variant="outline"
                    >
                        {dict.common.retry}
                    </Button>
                </Alert>
            )}
            {statusMessage !== null && (
                <p className="text-sm text-muted-foreground" role="status">
                    {statusMessage}
                </p>
            )}

            {!hasSeries ? (
                <EmptyState
                    title={p.createShowFirstCard}
                    description={p.episodeBelongsToShow}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/podcast/series/new" />}>
                            {p.createShow}
                        </Button>
                    }
                />
            ) : null}

            {hasSeries && formats.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    {p.noFormatsYetInline}{' '}
                    <LocaleLink href="/podcast/formats/new">{p.createFormats}</LocaleLink>
                    {' '}
                    {p.formatsRecommendedHint}
                </div>
            ) : null}

            {hasSeries && episodes.length === 0 ? (
                <EmptyState
                    title={p.emptyEpisodesTitle}
                    description={p.emptyEpisodesDescription}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/podcast/episodes/new" />}>
                            {p.createFirstEpisode}
                        </Button>
                    }
                />
            ) : null}

            {episodes.length > 0 ? (
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        busyItemId={busyEpisodeId}
                        contentLabelPlural={p.episodePlural}
                        editorBasePath="/podcast/episodes"
                        isBulkBusy={isBulkBusy}
                        items={listItems}
                        onBulkDelete={handleBulkDelete === null ? undefined : () => setIsBulkDeleteOpen(true)}
                        onBulkEdit={() => setIsBulkEditOpen(true)}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onCancelSchedule={(episode) => void handleCancelSchedule(episode)}
                        onDelete={handleDelete === null ? undefined : (episode) => setDeleteTarget(episode)}
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
                    <DeletePublicationDialog
                        contentLabel={p.episodeSingular}
                        item={deleteTarget}
                        onConfirm={() => void handleDeleteConfirm()}
                        onOpenChange={(open) => {
                            if (!open && !deletePending) {
                                setDeleteTarget(null)
                            }
                        }}
                        open={deleteTarget !== null}
                        pending={deletePending}
                    />
                    <BulkDeletePublicationDialog
                        contentLabel={p.episodeSingular}
                        contentLabelPlural={p.episodePlural}
                        items={bulkDeleteItems}
                        onConfirm={() => void handleBulkDeleteConfirm()}
                        onOpenChange={(open) => {
                            if (!open && !bulkDeletePending) {
                                setIsBulkDeleteOpen(false)
                            }
                        }}
                        open={isBulkDeleteOpen}
                        pending={bulkDeletePending}
                    />
                    <BulkEditDialog
                        busy={isBulkBusy}
                        categories={categories}
                        contentLabel={p.episodeSingular}
                        draftCount={draftCount}
                        formats={formats}
                        onApply={(operation) => void handleBulkEditApply(operation)}
                        onOpenChange={setIsBulkEditOpen}
                        open={isBulkEditOpen}
                        selectedCount={selectedIds.size}
                    />
                </>
            ) : null}
        </PageStack>
    )
}
