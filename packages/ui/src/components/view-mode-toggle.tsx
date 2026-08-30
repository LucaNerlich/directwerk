'use client'

import {LayoutGridIcon, LayoutListIcon} from 'lucide-react'

import {ToggleGroup, ToggleGroupItem} from '#components/toggle-group'
import {cn} from '#lib/utils'

export type ViewMode = 'list' | 'grid'

export function ViewModeToggle({
    value,
    onValueChange,
    disabled = false,
    className,
    label = 'Ansicht wechseln',
    listLabel = 'Liste',
    gridLabel = 'Raster',
}: {
    value: ViewMode
    onValueChange: (mode: ViewMode) => void
    disabled?: boolean
    className?: string
    label?: string
    listLabel?: string
    gridLabel?: string
}): React.JSX.Element {
    return (
        <ToggleGroup
            aria-label={label}
            className={cn('rounded-lg border bg-muted/40 p-1', className)}
            disabled={disabled}
            onValueChange={(values) => {
                const next = values[0]
                if (next === 'list' || next === 'grid') {
                    onValueChange(next)
                }
            }}
            spacing={0}
            value={[value]}
            variant="outline"
            size="sm"
        >
            <ToggleGroupItem aria-label={listLabel} value="list">
                <LayoutListIcon />
                <span className="sr-only sm:not-sr-only">{listLabel}</span>
            </ToggleGroupItem>
            <ToggleGroupItem aria-label={gridLabel} value="grid">
                <LayoutGridIcon />
                <span className="sr-only sm:not-sr-only">{gridLabel}</span>
            </ToggleGroupItem>
        </ToggleGroup>
    )
}
