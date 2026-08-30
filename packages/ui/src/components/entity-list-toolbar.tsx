'use client'

import type {ReactNode} from 'react'

import {Checkbox} from '#components/checkbox'
import {Label} from '#components/label'
import {ViewModeToggle, type ViewMode} from '#components/view-mode-toggle'
import {cn} from '#lib/utils'

export interface EntityListToolbarProps {
    selectedCount: number
    allSelected: boolean
    selectAllLabel: string
    selectionSummaryLabel?: string
    disabled?: boolean
    onToggleSelectAll: () => void
    bulkActions?: ReactNode
    viewMode?: ViewMode
    onViewModeChange?: (mode: ViewMode) => void
    showSelection?: boolean
    showViewToggle?: boolean
    className?: string
}

export function EntityListToolbar({
    selectedCount,
    allSelected,
    selectAllLabel,
    selectionSummaryLabel,
    disabled = false,
    onToggleSelectAll,
    bulkActions = null,
    viewMode,
    onViewModeChange,
    showSelection = true,
    showViewToggle = true,
    className,
}: EntityListToolbarProps): React.JSX.Element | null {
    if (!showSelection && !showViewToggle) {
        return null
    }

    const summary =
        selectionSummaryLabel ??
        (selectedCount > 0 ? `${selectedCount} ausgewählt` : 'Alle auswählen')

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
                            aria-label={selectAllLabel}
                            checked={allSelected}
                            disabled={disabled}
                            onCheckedChange={() => onToggleSelectAll()}
                        />
                        <span>{summary}</span>
                    </Label>
                    {selectedCount > 0 && bulkActions !== null ? bulkActions : null}
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
