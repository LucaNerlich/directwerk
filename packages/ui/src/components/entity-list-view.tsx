'use client'

import type {ElementType, ReactNode} from 'react'

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
    selectionDisabled?: boolean
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
    linkComponent: LinkComponent = 'a',
}: {
    title: ReactNode
    href?: string
    className?: string
    linkComponent?: EntityListLinkComponent
}) {
    if (href !== undefined) {
        return (
            <LinkComponent
                className={cn('font-medium hover:underline', className)}
                href={href}
            >
                {title}
            </LinkComponent>
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
    ariaLabel?: string
    gridClassName?: string
    linkComponent?: EntityListLinkComponent
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

export type EntityListLinkComponent = ElementType<{
    href: string
    className?: string
    children?: ReactNode
}>

export function EntityListView<TId extends EntityListItemId>({
    items,
    viewMode,
    selectable = false,
    selectedIds,
    onToggleSelection,
    ariaLabel,
    gridClassName,
    linkComponent,
    disabled = false,
}: EntityListViewProps<TId>): React.JSX.Element | null {
    const isSelectable =
        selectable &&
        selectedIds !== undefined &&
        onToggleSelection !== undefined

    if (items.length === 0) {
        return null
    }

    if (viewMode === 'grid') {
        return (
            <ul
                aria-label={ariaLabel}
                className={cn(
                    'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
                    gridClassName,
                )}
            >
                {items.map((item) => {
                    const isSelected = selectedIds?.has(item.id) ?? false

                    return (
                        <li
                            aria-selected={isSelectable ? isSelected : undefined}
                            className="h-full"
                            key={`${typeof item.id}:${String(item.id)}`}
                        >
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
                                            disabled={disabled || item.selectionDisabled === true}
                                            item={item}
                                            onToggle={() => onToggleSelection(item.id)}
                                        />
                                    ) : null}
                                    <CardTitle className="min-w-0 flex-1">
                                        <EntityListTitle
                                            className="line-clamp-2"
                                            href={item.href}
                                            linkComponent={linkComponent}
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
        <ListPanel aria-label={ariaLabel}>
            {items.map((item) => {
                const isSelected = selectedIds?.has(item.id) ?? false

                return (
                    <ListPanelRow
                        aria-selected={isSelectable ? isSelected : undefined}
                        className={isSelected ? 'bg-primary/5' : undefined}
                        key={`${typeof item.id}:${String(item.id)}`}
                    >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            {isSelectable ? (
                                <SelectionCheckbox
                                    checked={isSelected}
                                    className="mt-0.5"
                                    disabled={disabled || item.selectionDisabled === true}
                                    item={item}
                                    onToggle={() => onToggleSelection(item.id)}
                                />
                            ) : null}
                            {item.leading !== undefined ? (
                                <div className="shrink-0">{item.leading}</div>
                            ) : null}
                            <div className="min-w-0 flex-1">
                                <EntityListTitle
                                    href={item.href}
                                    linkComponent={linkComponent}
                                    title={item.title}
                                />
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
