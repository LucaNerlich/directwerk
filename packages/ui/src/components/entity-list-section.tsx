'use client'

import type {ReactNode} from 'react'

import {EntityListToolbar} from '#components/entity-list-toolbar'
import {
    EntityListView,
    type EntityListLinkComponent,
    type EntityListViewItem,
} from '#components/entity-list-view'
import type {ViewMode} from '#components/view-mode-toggle'
import type {EntityListItemId} from '#hooks/use-entity-list-selection'

interface EntityListSectionBaseProps<TId extends EntityListItemId> {
    items: EntityListViewItem<TId>[]
    viewMode: ViewMode
    ariaLabel?: string
    gridClassName?: string
    linkComponent?: EntityListLinkComponent
    disabled?: boolean
}

interface SwitchableEntityListSectionProps {
    onViewModeChange: (mode: ViewMode) => void
    showViewToggle?: true
    viewToggleLabel?: string
    viewListLabel?: string
    viewGridLabel?: string
}

interface FixedEntityListSectionProps {
    onViewModeChange?: never
    showViewToggle: false
    viewToggleLabel?: never
    viewListLabel?: never
    viewGridLabel?: never
}

interface SelectableEntityListSectionProps<TId extends EntityListItemId> {
    selectable: true
    selectedIds: ReadonlySet<TId>
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
        ) &
        (SwitchableEntityListSectionProps | FixedEntityListSectionProps)

export function EntityListSection<TId extends EntityListItemId>(
    props: EntityListSectionProps<TId>,
): React.JSX.Element {
    const {
        items,
        viewMode,
        ariaLabel,
        gridClassName,
        linkComponent,
        disabled = false,
    } = props
    const showViewToggle = props.showViewToggle !== false
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
                        onViewModeChange={props.onViewModeChange}
                        selectAllLabel={props.selectAllLabel}
                        selectedCount={props.selectedIds.size}
                        showViewToggle={showViewToggle}
                        viewGridLabel={props.viewGridLabel}
                        viewListLabel={props.viewListLabel}
                        viewMode={viewMode}
                        viewToggleLabel={props.viewToggleLabel}
                    />
                ) : (
                    <EntityListToolbar
                        disabled={disabled}
                        onViewModeChange={props.onViewModeChange}
                        showSelection={false}
                        showViewToggle={showViewToggle}
                        viewGridLabel={props.viewGridLabel}
                        viewListLabel={props.viewListLabel}
                        viewMode={viewMode}
                        viewToggleLabel={props.viewToggleLabel}
                    />
                )
            ) : null}
            {props.selectable === true ? (
                <EntityListView
                    disabled={disabled}
                    ariaLabel={ariaLabel}
                    gridClassName={gridClassName}
                    items={items}
                    linkComponent={linkComponent}
                    onToggleSelection={props.onToggleSelection}
                    selectable
                    selectedIds={props.selectedIds}
                    viewMode={viewMode}
                />
            ) : (
                <EntityListView
                    disabled={disabled}
                    ariaLabel={ariaLabel}
                    gridClassName={gridClassName}
                    items={items}
                    linkComponent={linkComponent}
                    viewMode={viewMode}
                />
            )}
        </>
    )
}
