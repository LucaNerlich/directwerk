'use client'

import type {ReactNode} from 'react'

import {EntityListToolbar} from '#components/entity-list-toolbar'
import {EntityListView, type EntityListViewItem} from '#components/entity-list-view'
import type {ViewMode} from '#components/view-mode-toggle'
import type {EntityListItemId} from '#hooks/use-entity-list-selection'

export function EntityListSection({
    items,
    viewMode,
    onViewModeChange,
    selectable = false,
    selectedIds,
    selectedCount = 0,
    allSelected = false,
    onToggleSelectAll,
    onToggleSelection,
    selectAllLabel = 'Alle auswählen',
    bulkActions = null,
    disabled = false,
    showSelection = false,
    showViewToggle = true,
}: {
    items: EntityListViewItem[]
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
    selectable?: boolean
    selectedIds?: Set<EntityListItemId>
    selectedCount?: number
    allSelected?: boolean
    onToggleSelectAll?: () => void
    onToggleSelection?: (id: EntityListItemId) => void
    selectAllLabel?: string
    bulkActions?: ReactNode
    disabled?: boolean
    showSelection?: boolean
    showViewToggle?: boolean
}): React.JSX.Element {
    const hasToolbar = items.length > 0 && (showViewToggle || showSelection)

    return (
        <>
            {hasToolbar ? (
                <EntityListToolbar
                    allSelected={allSelected}
                    bulkActions={bulkActions}
                    disabled={disabled}
                    onToggleSelectAll={onToggleSelectAll ?? (() => undefined)}
                    onViewModeChange={onViewModeChange}
                    selectAllLabel={selectAllLabel}
                    selectedCount={selectedCount}
                    showSelection={showSelection}
                    showViewToggle={showViewToggle}
                    viewMode={viewMode}
                />
            ) : null}
            <EntityListView
                disabled={disabled}
                items={items}
                onToggleSelection={onToggleSelection}
                selectable={selectable}
                selectedIds={selectedIds}
                viewMode={viewMode}
            />
        </>
    )
}
