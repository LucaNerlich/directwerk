'use client'

import PublicationListToolbar from '@/components/publication/PublicationListToolbar'
import PublicationListView, {
    type PublicationListItem,
} from '@/components/publication/PublicationListView'
import type {PublicationListViewMode} from '@/lib/publication/usePublicationListSelection'

interface PublicationListSectionProps<T extends PublicationListItem> {
    items: T[]
    editorBasePath: string
    contentLabelPlural: string
    selectedIds: Set<number>
    selectedCount: number
    allSelected: boolean
    viewMode: PublicationListViewMode
    publishableCount: number
    unpublishableCount: number
    isBulkBusy: boolean
    busyItemId: number | null
    onToggleSelectAll: () => void
    onViewModeChange: (mode: PublicationListViewMode) => void
    onBulkPublish: () => void
    onBulkUnpublish: () => void
    onToggleSelection: (id: number) => void
    onPublish: (item: T) => void
    onUnpublish: (item: T) => void
    onCancelSchedule: (item: T) => void
    onUnarchive: (item: T) => void
}

export default function PublicationListSection<T extends PublicationListItem>({
    items,
    editorBasePath,
    contentLabelPlural,
    selectedIds,
    selectedCount,
    allSelected,
    viewMode,
    publishableCount,
    unpublishableCount,
    isBulkBusy,
    busyItemId,
    onToggleSelectAll,
    onViewModeChange,
    onBulkPublish,
    onBulkUnpublish,
    onToggleSelection,
    onPublish,
    onUnpublish,
    onCancelSchedule,
    onUnarchive,
}: PublicationListSectionProps<T>): React.JSX.Element {
    return (
        <>
            <PublicationListToolbar
                allSelected={allSelected}
                contentLabelPlural={contentLabelPlural}
                isBulkBusy={isBulkBusy}
                onBulkPublish={onBulkPublish}
                onBulkUnpublish={onBulkUnpublish}
                onToggleSelectAll={onToggleSelectAll}
                onViewModeChange={onViewModeChange}
                publishableCount={publishableCount}
                selectedCount={selectedCount}
                unpublishableCount={unpublishableCount}
                viewMode={viewMode}
            />
            <PublicationListView
                busyItemId={busyItemId}
                editorBasePath={editorBasePath}
                isBulkBusy={isBulkBusy}
                items={items}
                onCancelSchedule={onCancelSchedule}
                onPublish={onPublish}
                onToggleSelection={onToggleSelection}
                onUnarchive={onUnarchive}
                onUnpublish={onUnpublish}
                selectedIds={selectedIds}
                viewMode={viewMode}
            />
        </>
    )
}
