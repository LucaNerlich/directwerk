'use client'

import type {ReactNode} from 'react'

import {Checkbox} from '#components/checkbox'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '#components/card'
import {Label} from '#components/label'
import ListPanel, {ListPanelRow} from '#components/list-panel'
import type {ViewMode} from '#components/view-mode-toggle'
import {cn} from '#lib/utils'

import type {EntityListItemId} from '#hooks/use-entity-list-selection'

export interface EntityListViewItem<
    TId extends EntityListItemId = EntityListItemId,
> {
    id: TId
    title: ReactNode
    selectionLabel?: string
    description?: ReactNode
    descriptions?: ReactNode[]
    trailing?: ReactNode
    href?: string
    actions?: ReactNode
    extra?: ReactNode
    leading?: ReactNode
}

function itemSelectionLabel<TId extends EntityListItemId>(
    item: EntityListViewItem<TId>,
): string {
    return (
        item.selectionLabel ??
        (typeof item.title === 'string'
            ? item.title
            : `Eintrag ${String(item.id)}`)
    )
}

function SelectionCheckbox<TId extends EntityListItemId>({
    item,
    checked,
    disabled,
    onToggle,
    className,
}: {
    item: EntityListViewItem<TId>
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
                <div className="text-sm text-muted-foreground" key={index}>
                    {line}
                </div>
            ))}
        </>
    )
}

interface EntityListViewBaseProps<TId extends EntityListItemId> {
    items: EntityListViewItem<TId>[]
    viewMode: ViewMode
    disabled?: boolean
}

interface SelectableEntityListViewProps<TId extends EntityListItemId> {
    selectable: true
    selectedIds: ReadonlySet<TId>
    onToggleSelection: (id: TId) => void
}

interface StaticEntityListViewProps {
    selectable?: false
    selectedIds?: never
    onToggleSelection?: never
}

export type EntityListViewProps<TId extends EntityListItemId> =
    EntityListViewBaseProps<TId> &
        (SelectableEntityListViewProps<TId> | StaticEntityListViewProps)

export function EntityListView<TId extends EntityListItemId>({
    items,
    viewMode,
    selectable = false,
    selectedIds,
    onToggleSelection,
    disabled = false,
}: EntityListViewProps<TId>): React.JSX.Element {
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
                        <li className="h-full" key={`${typeof item.id}:${String(item.id)}`}>
                            <Card
                                className={cn(
                                    'h-full',
                                    isSelected && 'ring-2 ring-primary',
                                )}
                                size="sm"
                            >
                                <CardHeader className="flex flex-row items-start gap-3">
                                    {isSelectable ? (
                                        <SelectionCheckbox
                                            checked={isSelected}
                                            disabled={disabled}
                                            item={item}
                                            onToggle={() => onToggleSelection(item.id)}
                                        />
                                    ) : null}
                                    <CardTitle className="min-w-0 flex-1">
                                        <EntityListTitle
                                            className="line-clamp-2"
                                            href={item.href}
                                            title={item.title}
                                        />
                                    </CardTitle>
                                    {item.trailing !== undefined ? (
                                        <div className="shrink-0">{item.trailing}</div>
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
                        key={`${typeof item.id}:${String(item.id)}`}
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
                        {item.trailing !== undefined || item.actions !== undefined ? (
                            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                                {item.trailing}
                                {item.actions}
                            </div>
                        ) : null}
                    </ListPanelRow>
                )
            })}
        </ListPanel>
    )
}
