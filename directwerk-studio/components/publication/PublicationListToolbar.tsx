'use client'

import {Button} from '@directwerk/ui/components/button'

import type {PublicationListViewMode} from '@/lib/publication/usePublicationListSelection'

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
    const showBulkActions = selectedCount > 0

    return (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                        aria-label={`Alle ${contentLabelPlural} auswählen`}
                        checked={allSelected}
                        className="size-4 shrink-0"
                        disabled={isBulkBusy}
                        onChange={() => onToggleSelectAll()}
                        type="checkbox"
                    />
                    <span>
                        {selectedCount > 0
                            ? `${selectedCount} ausgewählt`
                            : `Alle auswählen`}
                    </span>
                </label>
                {showBulkActions ? (
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                ) : null}
            </div>
            <div
                className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
                role="group"
                aria-label="Ansicht wechseln"
            >
                <Button
                    aria-pressed={viewMode === 'list'}
                    disabled={isBulkBusy}
                    onClick={() => onViewModeChange('list')}
                    size="sm"
                    type="button"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                >
                    Liste
                </Button>
                <Button
                    aria-pressed={viewMode === 'grid'}
                    disabled={isBulkBusy}
                    onClick={() => onViewModeChange('grid')}
                    size="sm"
                    type="button"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                >
                    Raster
                </Button>
            </div>
        </div>
    )
}
