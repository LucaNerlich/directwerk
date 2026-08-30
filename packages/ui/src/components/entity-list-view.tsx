'use client'

import type {ReactNode} from 'react'

import {Checkbox} from '#components/checkbox'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '#components/card'
import {Label} from '#components/label'
import ListPanel, {ListPanelRow} from '#components/list-panel'
import type {ViewMode} from '#components/view-mode-toggle'
import {cn} from '#lib/utils'

import type {EntityListItemId} from '#hooks/use-entity-list-selection'

export interface EntityListViewItem {
    id: EntityListItemId
    title: ReactNode
    description?: ReactNode
    descriptions?: ReactNode[]
    trailing?: ReactNode
    href?: string
    actions?: ReactNode
    extra?: ReactNode
    leading?: ReactNode
}

function itemSelectionLabel(item: EntityListViewItem): string {
    return typeof item.title === 'string' ? item.title : `Eintrag ${String(item.id)}`
}

function SelectionCheckbox({
    item,
    checked,
    disabled,
    onToggle,
    className,
}: {
    item: EntityListViewItem
    checked: boolean
    disabled: boolean
    onToggle: () => void
    className?: string
}) {
    const label = itemSelectionLabel(item)

    return (
        <Label className={className}>
            <Checkbox
                aria-label={`„${label}“ auswählen`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(next) => {
                    if (next !== checked) {
                        onToggle()
                    }
                }}
            />
        </Label>
    )
}

function EntityListTitle({
    title,
    href,
    className,
}: {
    title: ReactNode
    href?: string
    className?: string
}) {
    if (href !== undefined) {
        return (
            <a className={cn('font-medium hover:underline', className)} href={href}>
                {title}
            </a>
        )
    }

    if (typeof title === 'string') {
        return <p className={cn('font-medium', className)}>{title}</p>
    }

    return <div className={className}>{title}</div>
}

function EntityListDescriptions({
    description,
    descriptions = [],
}: {
    description?: ReactNode
    descriptions?: ReactNode[]
}) {
    const lines =
        description !== undefined ? [description, ...descriptions] : descriptions

    if (lines.length === 0) {
        return null
    }

    return (
        <>
            {lines.map((line, index) => (
                <p className="text-sm text-muted-foreground" key={index}>
                    {line}
                </p>
            ))}
        </>
    )
}

export function EntityListView({
    items,
    viewMode,
    selectable = false,
    selectedIds,
    onToggleSelection,
    disabled = false,
}: {
    items: EntityListViewItem[]
    viewMode: ViewMode
    selectable?: boolean
    selectedIds?: Set<EntityListItemId>
    onToggleSelection?: (id: EntityListItemId) => void
    disabled?: boolean
}): React.JSX.Element {
    const isSelectable =
        selectable &&
        selectedIds !== undefined &&
        onToggleSelection !== undefined

    if (viewMode === 'grid') {
        return (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                    const isSelected = selectedIds?.has(item.id) ?? false

                    return (
                        <li key={String(item.id)}>
                            <Card
                                className={isSelected ? 'ring-2 ring-primary' : undefined}
                                size="sm"
                            >
                                <CardHeader className="grid-cols-[auto_1fr_auto] items-start gap-3">
                                    {isSelectable ? (
                                        <SelectionCheckbox
                                            checked={isSelected}
                                            disabled={disabled}
                                            item={item}
                                            onToggle={() => onToggleSelection(item.id)}
                                        />
                                    ) : null}
                                    <CardTitle className="min-w-0">
                                        <EntityListTitle
                                            className="line-clamp-2"
                                            href={item.href}
                                            title={item.title}
                                        />
                                    </CardTitle>
                                    {item.trailing !== undefined ? (
                                        <div className="justify-self-end">{item.trailing}</div>
                                    ) : null}
                                </CardHeader>
                                {(item.leading !== undefined ||
                                    item.description !== undefined ||
                                    item.descriptions !== undefined ||
                                    item.extra !== undefined) ? (
                                    <CardContent className="flex flex-col gap-3">
                                        {item.leading}
                                        <EntityListDescriptions
                                            description={item.description}
                                            descriptions={item.descriptions}
                                        />
                                        {item.extra}
                                    </CardContent>
                                ) : null}
                                {item.actions !== undefined ? (
                                    <CardFooter className="flex flex-wrap gap-2">
                                        {item.actions}
                                    </CardFooter>
                                ) : null}
                            </Card>
                        </li>
                    )
                })}
            </ul>
        )
    }

    return (
        <ListPanel>
            {items.map((item) => {
                const isSelected = selectedIds?.has(item.id) ?? false

                return (
                    <ListPanelRow
                        className={isSelected ? 'bg-primary/5' : undefined}
                        key={String(item.id)}
                    >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            {isSelectable ? (
                                <SelectionCheckbox
                                    checked={isSelected}
                                    className="mt-0.5"
                                    disabled={disabled}
                                    item={item}
                                    onToggle={() => onToggleSelection(item.id)}
                                />
                            ) : null}
                            {item.leading !== undefined ? (
                                <div className="shrink-0">{item.leading}</div>
                            ) : null}
                            <div className="min-w-0 flex-1">
                                <EntityListTitle href={item.href} title={item.title} />
                                <EntityListDescriptions
                                    description={item.description}
                                    descriptions={item.descriptions}
                                />
                                {item.extra !== undefined ? (
                                    <div className="mt-3">{item.extra}</div>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                            {item.trailing}
                            {item.actions}
                        </div>
                    </ListPanelRow>
                )
            })}
        </ListPanel>
    )
}
