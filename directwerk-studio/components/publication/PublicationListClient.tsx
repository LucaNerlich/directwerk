'use client'

import {useCallback, useMemo, useState, type ReactNode} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import PublicationListSection, {
    type PublicationListItem,
} from '@/components/publication/PublicationListSection'
import BulkEditDialog, {type BulkEditOperation} from '@/components/publication/BulkEditDialog'
import BulkDeletePublicationDialog from '@/components/publication/BulkDeletePublicationDialog'
import DeletePublicationDialog from '@/components/publication/DeletePublicationDialog'
import type {CategorySummary, FormatSummary, PublicationStatus} from '@directwerk/api/types'
import {
    usePublicationListPage,
    type PublicationListPageConfig,
} from '@/lib/publication/usePublicationListPage'

type PublicationListEntity = {
    id: number
    title: string
    status: PublicationStatus
    slug?: string
    publishedAt: string | null
}

type RunBulkEdit<T extends PublicationListEntity> = (
    eligible: T[],
    action: (id: number) => Promise<T>,
    successMessage: (count: number) => string,
    partialMessage: (successCount: number, failureCount: number) => string,
    errorMessageText: string,
) => Promise<void>

export type PublicationListClientContext<T extends PublicationListEntity> = {
    items: T[]
    selectedIds: ReadonlySet<number>
    isBulkBusy: boolean
    reload: () => Promise<void>
}

export interface PublicationListClientProps<T extends PublicationListEntity> {
    page: PublicationListPageConfig<T>
    loadingMessage: string
    header: {
        eyebrow: string
        title: string
        description: string
        actions?: ReactNode
    }
    contentLabel: string
    contentLabelPlural: string
    editorBasePath: string
    retryLabel: string
    /** Merged with page loading (e.g. episode prerequisites). */
    externalLoading?: boolean
    /** Shown in preference to the page error when set (e.g. prereq failure). */
    externalError?: string | null
    /** Extra work on retry (e.g. reload prerequisites). Page reload always runs. */
    onRetry?: () => void
    mapItems?: (items: T[]) => Array<T & PublicationListItem>
    publishBlockedReason?: (item: T & PublicationListItem) => string | null
    /** Banners / prerequisite empty states above the list body. */
    renderAboveList?: (ctx: PublicationListClientContext<T>) => ReactNode
    /** When the loaded list is empty (after prerequisites). */
    renderEmpty?: (ctx: PublicationListClientContext<T>) => ReactNode
    bulkEdit: {
        categories: CategorySummary[]
        formats?: FormatSummary[]
        onOpen?: () => void
        onApply: (args: {
            operation: BulkEditOperation
            eligible: T[]
            runBulkEdit: RunBulkEdit<T>
        }) => Promise<void>
    }
}

export default function PublicationListClient<T extends PublicationListEntity>({
    page,
    loadingMessage,
    header,
    contentLabel,
    contentLabelPlural,
    editorBasePath,
    retryLabel,
    externalLoading = false,
    externalError = null,
    onRetry,
    mapItems,
    publishBlockedReason,
    renderAboveList,
    renderEmpty,
    bulkEdit,
}: PublicationListClientProps<T>): React.JSX.Element {
    const {
        items,
        isLoading: pageLoading,
        displayError: pageError,
        statusMessage,
        reload,
        busyItemId,
        isBulkBusy,
        selectedIds,
        allSelected,
        viewMode,
        setViewMode,
        toggleSelection,
        toggleSelectAll,
        publishableCount,
        unpublishableCount,
        hasMore,
        loadMore,
        handlePublish,
        handleUnpublish,
        handleCancelSchedule,
        handleUnarchive,
        handleDelete,
        handleBulkPublish,
        handleBulkUnpublish,
        handleBulkDelete,
        runBulkEdit,
    } = usePublicationListPage<T>(page)

    const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
    const [deletePending, setDeletePending] = useState(false)
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
    const [bulkDeletePending, setBulkDeletePending] = useState(false)
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)

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
        () => items.filter((item) => selectedIds.has(item.id)),
        [items, selectedIds],
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
            items.filter(
                (item) => selectedIds.has(item.id) && item.status === 'DRAFT',
            ).length,
        [items, selectedIds],
    )

    const {categories, formats, onOpen: onBulkEditOpen, onApply: onBulkEditApply} =
        bulkEdit

    const handleBulkEditOpenChange = useCallback(
        (open: boolean): void => {
            setIsBulkEditOpen(open)
            if (open) {
                onBulkEditOpen?.()
            }
        },
        [onBulkEditOpen],
    )

    const handleBulkEditApply = useCallback(
        async (operation: BulkEditOperation): Promise<void> => {
            const eligible = items.filter(
                (item) => selectedIds.has(item.id) && item.status === 'DRAFT',
            )
            if (eligible.length === 0) {
                return
            }
            await onBulkEditApply({operation, eligible, runBulkEdit})
            setIsBulkEditOpen(false)
        },
        [items, onBulkEditApply, runBulkEdit, selectedIds],
    )

    const listItems = useMemo(
        () => (mapItems === undefined ? items : mapItems(items)),
        [items, mapItems],
    )

    const ctx: PublicationListClientContext<T> = {
        items,
        selectedIds,
        isBulkBusy,
        reload,
    }

    const isLoading = externalLoading || pageLoading
    const displayError = externalError ?? pageError

    function handleRetryClick(): void {
        onRetry?.()
        void reload()
    }

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {loadingMessage}
            </p>
        )
    }

    return (
        <PageStack className="gap-6">
            <PageHeader
                eyebrow={header.eyebrow}
                title={header.title}
                description={header.description}
                actions={header.actions}
            />
            {displayError !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{displayError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={handleRetryClick}
                        type="button"
                        variant="outline"
                    >
                        {retryLabel}
                    </Button>
                </Alert>
            )}
            {statusMessage !== null && (
                <p className="text-sm text-muted-foreground" role="status">
                    {statusMessage}
                </p>
            )}
            {renderAboveList?.(ctx)}
            {items.length === 0 ? (
                renderEmpty?.(ctx)
            ) : (
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        hasMore={hasMore}
                        onLoadMore={() => void loadMore()}
                        busyItemId={busyItemId}
                        contentLabelPlural={contentLabelPlural}
                        editorBasePath={editorBasePath}
                        isBulkBusy={isBulkBusy}
                        items={listItems}
                        onBulkDelete={
                            handleBulkDelete === null
                                ? undefined
                                : () => setIsBulkDeleteOpen(true)
                        }
                        onBulkEdit={() => handleBulkEditOpenChange(true)}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onCancelSchedule={(item) => void handleCancelSchedule(item)}
                        onDelete={
                            handleDelete === null
                                ? undefined
                                : (item) => setDeleteTarget(item)
                        }
                        onPublish={(item) => void handlePublish(item)}
                        onToggleSelectAll={toggleSelectAll}
                        onToggleSelection={toggleSelection}
                        onUnarchive={(item) => void handleUnarchive(item)}
                        onUnpublish={(item) => void handleUnpublish(item)}
                        onViewModeChange={setViewMode}
                        publishBlockedReason={publishBlockedReason}
                        publishableCount={publishableCount}
                        selectedIds={selectedIds}
                        unpublishableCount={unpublishableCount}
                        viewMode={viewMode}
                    />
                    <DeletePublicationDialog
                        contentLabel={contentLabel}
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
                        contentLabel={contentLabel}
                        contentLabelPlural={contentLabelPlural}
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
                        contentLabel={contentLabel}
                        draftCount={draftCount}
                        formats={formats}
                        onApply={(operation) => void handleBulkEditApply(operation)}
                        onOpenChange={handleBulkEditOpenChange}
                        open={isBulkEditOpen}
                        selectedCount={selectedIds.size}
                    />
                </>
            )}
        </PageStack>
    )
}
