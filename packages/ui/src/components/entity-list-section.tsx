'use client'

import type {ReactNode} from 'react'

import {EntityListToolbar} from '#components/entity-list-toolbar'
import {EntityListView, type EntityListViewItem} from '#components/entity-list-view'
import type {ViewMode} from '#components/view-mode-toggle'
import type {EntityListItemId} from '#hooks/use-entity-list-selection'

interface EntityListSectionBaseProps<TId extends EntityListItemId> {
    items: EntityListViewItem<TId>[]
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
    disabled?: boolean
    showViewToggle?: boolean
}

interface SelectableEntityListSectionProps<TId extends EntityListItemId> {
    selectable: true
    selectedIds: ReadonlySet<TId>
    selectedCount: number
    allSelected: boolean
    onToggleSelectAll: () => void
    onToggleSelection: (id: TId) => void
    selectAllLabel: string
    bulkActions?: ReactNode
    showSelection?: boolean
}

interface StaticEntityListSectionProps {
    selectable?: false
    selectedIds?: never
    selectedCount?: never
    allSelected?: never
    onToggleSelectAll?: never
    onToggleSelection?: never
    selectAllLabel?: never
    bulkActions?: never
    showSelection?: false
}

export type EntityListSectionProps<TId extends EntityListItemId> =
    EntityListSectionBaseProps<TId> &
        (
            | SelectableEntityListSectionProps<TId>
            | StaticEntityListSectionProps
        )

export function EntityListSection<TId extends EntityListItemId>(
    props: EntityListSectionProps<TId>,
): React.JSX.Element {
    const {
        items,
        viewMode,
        onViewModeChange,
        disabled = false,
        showViewToggle = true,
    } = props
    const showSelection =
        props.selectable === true && (props.showSelection ?? true)
    const hasToolbar = items.length > 0 && (showViewToggle || showSelection)

    return (
        <>
            {hasToolbar ? (
                props.selectable === true && showSelection ? (
                    <EntityListToolbar
                        allSelected={props.allSelected}
                        bulkActions={props.bulkActions}
                        disabled={disabled}
                        onToggleSelectAll={props.onToggleSelectAll}
                        onViewModeChange={onViewModeChange}
                        selectAllLabel={props.selectAllLabel}
                        selectedCount={props.selectedCount}
                        showViewToggle={showViewToggle}
                        viewMode={viewMode}
                    />
                ) : (
                    <EntityListToolbar
                        disabled={disabled}
                        onViewModeChange={onViewModeChange}
                        showSelection={false}
                        showViewToggle={showViewToggle}
                        viewMode={viewMode}
                    />
                )
            ) : null}
            {props.selectable === true ? (
                <EntityListView
                    disabled={disabled}
                    items={items}
                    onToggleSelection={props.onToggleSelection}
                    selectable
                    selectedIds={props.selectedIds}
                    viewMode={viewMode}
                />
            ) : (
                <EntityListView
                    disabled={disabled}
                    items={items}
                    viewMode={viewMode}
                />
            )}
        </>
    )
}
