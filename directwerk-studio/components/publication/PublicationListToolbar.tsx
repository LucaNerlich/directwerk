'use client'

import {Button} from '@directwerk/ui/components/button'
import {EntityListToolbar} from '@directwerk/ui/components/entity-list-toolbar'

import type {PublicationListViewMode} from '@/lib/publication/usePublicationListState'

interface PublicationListToolbarProps {
    selectedCount: number
    allSelected: boolean
    viewMode: PublicationListViewMode
    publishableCount: number
    unpublishableCount: number
    isBulkBusy: boolean
    onToggleSelectAll: () => void
    onViewModeChange: (mode: PublicationListViewMode) => void
    onBulkPublish: () => void
    onBulkUnpublish: () => void
    contentLabelPlural: string
}

export default function PublicationListToolbar({
    selectedCount,
    allSelected,
    viewMode,
    publishableCount,
    unpublishableCount,
    isBulkBusy,
    onToggleSelectAll,
    onViewModeChange,
    onBulkPublish,
    onBulkUnpublish,
    contentLabelPlural,
}: PublicationListToolbarProps): React.JSX.Element {
    return (
        <EntityListToolbar
            allSelected={allSelected}
            bulkActions={
                <>
                    {publishableCount > 0 ? (
                        <Button
                            disabled={isBulkBusy}
                            onClick={() => void onBulkPublish()}
                            size="sm"
                            type="button"
                        >
                            {isBulkBusy
                                ? 'Wird veröffentlicht…'
                                : `${publishableCount} veröffentlichen`}
                        </Button>
                    ) : null}
                    {unpublishableCount > 0 ? (
                        <Button
                            disabled={isBulkBusy}
                            onClick={() => void onBulkUnpublish()}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {isBulkBusy
                                ? 'Wird zurückgezogen…'
                                : `${unpublishableCount} zurückziehen`}
                        </Button>
                    ) : null}
                </>
            }
            disabled={isBulkBusy}
            onToggleSelectAll={onToggleSelectAll}
            onViewModeChange={onViewModeChange}
            selectAllLabel={`Alle ${contentLabelPlural} auswählen`}
            selectedCount={selectedCount}
            viewMode={viewMode}
        />
    )
}
