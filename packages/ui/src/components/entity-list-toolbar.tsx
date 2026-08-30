'use client'

import type {ReactNode} from 'react'

import {Checkbox} from '#components/checkbox'
import {Label} from '#components/label'
import {ViewModeToggle, type ViewMode} from '#components/view-mode-toggle'
import {cn} from '#lib/utils'

interface EntityListToolbarCommonProps {
    selectionSummaryLabel?: string
    disabled?: boolean
    viewMode?: ViewMode
    onViewModeChange?: (mode: ViewMode) => void
    showViewToggle?: boolean
    className?: string
}

interface EntityListToolbarSelectionProps {
    selectedCount: number
    allSelected: boolean
    selectAllLabel: string
    onToggleSelectAll: () => void
    bulkActions?: ReactNode
    showSelection?: true
}

interface EntityListToolbarWithoutSelectionProps {
    selectedCount?: never
    allSelected?: never
    selectAllLabel?: never
    onToggleSelectAll?: never
    bulkActions?: never
    showSelection: false
}

export type EntityListToolbarProps = EntityListToolbarCommonProps &
    (
        | EntityListToolbarSelectionProps
        | EntityListToolbarWithoutSelectionProps
    )

export function EntityListToolbar(
    props: EntityListToolbarProps,
): React.JSX.Element | null {
    const {
        selectionSummaryLabel,
        disabled = false,
        viewMode,
        onViewModeChange,
        showViewToggle = true,
        className,
    } = props
    const showSelection = props.showSelection !== false

    if (!showSelection && !showViewToggle) {
        return null
    }

    const selectedCount = showSelection ? props.selectedCount : 0
    const summary = showSelection
        ? selectionSummaryLabel ??
          (selectedCount > 0 ? `${selectedCount} ausgewählt` : 'Alle auswählen')
        : null

    return (
        <div
            className={cn(
                'flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
                !showSelection && showViewToggle && 'sm:justify-end',
                className,
            )}
        >
            {showSelection ? (
                <div className="flex flex-wrap items-center gap-3">
                    <Label className="cursor-pointer">
                        <Checkbox
                            checked={props.allSelected}
                            disabled={disabled}
                            indeterminate={selectedCount > 0 && !props.allSelected}
                            onCheckedChange={() => props.onToggleSelectAll()}
                        />
                        <span className="sr-only">{props.selectAllLabel}</span>
                        <span aria-hidden="true">{summary}</span>
                    </Label>
                    {selectedCount > 0 && props.bulkActions !== undefined
                        ? props.bulkActions
                        : null}
                </div>
            ) : null}
            {showViewToggle && viewMode !== undefined && onViewModeChange !== undefined ? (
                <ViewModeToggle
                    disabled={disabled}
                    onValueChange={onViewModeChange}
                    value={viewMode}
                />
            ) : null}
        </div>
    )
}
