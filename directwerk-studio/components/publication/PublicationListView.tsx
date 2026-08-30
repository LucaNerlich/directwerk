'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import {Label} from '@directwerk/ui/components/label'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@directwerk/ui/components/card'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import type {PublicationListViewMode} from '@/lib/publication/usePublicationListSelection'
import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationListItem {
    id: number
    title: string
    status: PublicationStatus
    publishedAt: string | null
    meta?: string | null
}

interface PublicationListViewProps<T extends PublicationListItem> {
    items: T[]
    editorBasePath: string
    viewMode: PublicationListViewMode
    selectedIds: Set<number>
    busyItemId: number | null
    isBulkBusy: boolean
    onToggleSelection: (id: number) => void
    onPublish: (item: T) => void
    onUnpublish: (item: T) => void
    onCancelSchedule: (item: T) => void
    onUnarchive: (item: T) => void
}

function formatPublishedAt(value: string | null): string | null {
    if (value === null) {
        return null
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return null
    }
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
}

function SelectionCheckbox({
    title,
    checked,
    disabled,
    onToggle,
    className,
}: {
    title: string
    checked: boolean
    disabled: boolean
    onToggle: () => void
    className?: string
}) {
    return (
        <Label className={className}>
            <Checkbox
                aria-label={`„${title}“ auswählen`}
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

function PublicationRowActions<T extends PublicationListItem>({
    item,
    isBusy,
    disabled,
    onPublish,
    onUnpublish,
    onCancelSchedule,
    onUnarchive,
}: {
    item: T
    isBusy: boolean
    disabled: boolean
    onPublish: (item: T) => void
    onUnpublish: (item: T) => void
    onCancelSchedule: (item: T) => void
    onUnarchive: (item: T) => void
}) {
    return (
        <>
            {item.status === 'DRAFT' ? (
                <Button
                    disabled={disabled || isBusy}
                    onClick={() => void onPublish(item)}
                    size="sm"
                    type="button"
                >
                    {isBusy ? 'Wird veröffentlicht…' : 'Veröffentlichen'}
                </Button>
            ) : null}
            {item.status === 'PUBLISHED' ? (
                <Button
                    disabled={disabled || isBusy}
                    onClick={() => void onUnpublish(item)}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {isBusy ? 'Wird zurückgezogen…' : 'Zurückziehen'}
                </Button>
            ) : null}
            {item.status === 'SCHEDULED' ? (
                <Button
                    disabled={disabled || isBusy}
                    onClick={() => void onCancelSchedule(item)}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {isBusy ? 'Wird abgebrochen…' : 'Planung aufheben'}
                </Button>
            ) : null}
            {item.status === 'ARCHIVED' ? (
                <Button
                    disabled={disabled || isBusy}
                    onClick={() => void onUnarchive(item)}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {isBusy ? 'Wird wiederhergestellt…' : 'Wiederherstellen'}
                </Button>
            ) : null}
        </>
    )
}

export default function PublicationListView<T extends PublicationListItem>({
    items,
    editorBasePath,
    viewMode,
    selectedIds,
    busyItemId,
    isBulkBusy,
    onToggleSelection,
    onPublish,
    onUnpublish,
    onCancelSchedule,
    onUnarchive,
}: PublicationListViewProps<T>): React.JSX.Element {
    if (viewMode === 'grid') {
        return (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                    const isBusy = busyItemId === item.id
                    const isSelected = selectedIds.has(item.id)
                    const publishedLabel = formatPublishedAt(item.publishedAt)
                    const metaLabel = item.meta ?? null

                    return (
                        <li key={item.id}>
                            <Card
                                className={isSelected ? 'ring-2 ring-primary' : undefined}
                                size="sm"
                            >
                                <CardHeader className="grid-cols-[auto_1fr] items-start gap-3">
                                    <SelectionCheckbox
                                        checked={isSelected}
                                        disabled={isBulkBusy}
                                        onToggle={() => onToggleSelection(item.id)}
                                        title={item.title}
                                    />
                                    <CardTitle className="min-w-0">
                                        <Link
                                            className="line-clamp-2 hover:underline"
                                            href={`${editorBasePath}/${item.id}`}
                                        >
                                            {item.title}
                                        </Link>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    <PublicationStatusBadge status={item.status} />
                                    {publishedLabel !== null ? (
                                        <p className="text-xs text-muted-foreground">
                                            Veröffentlicht am {publishedLabel}
                                        </p>
                                    ) : metaLabel !== null ? (
                                        <p className="text-xs text-muted-foreground">
                                            <code>{metaLabel}</code>
                                        </p>
                                    ) : null}
                                </CardContent>
                                <CardFooter className="flex flex-wrap gap-2">
                                    <PublicationRowActions
                                        disabled={isBulkBusy}
                                        isBusy={isBusy}
                                        item={item}
                                        onCancelSchedule={onCancelSchedule}
                                        onPublish={onPublish}
                                        onUnarchive={onUnarchive}
                                        onUnpublish={onUnpublish}
                                    />
                                </CardFooter>
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
                const isBusy = busyItemId === item.id
                const isSelected = selectedIds.has(item.id)
                const publishedLabel = formatPublishedAt(item.publishedAt)
                const metaLabel = item.meta ?? null

                return (
                    <ListPanelRow
                        className={isSelected ? 'bg-primary/5' : undefined}
                        key={item.id}
                    >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <SelectionCheckbox
                                checked={isSelected}
                                className="mt-0.5"
                                disabled={isBulkBusy}
                                onToggle={() => onToggleSelection(item.id)}
                                title={item.title}
                            />
                            <div className="min-w-0 flex-1">
                                <Link
                                    className="font-medium hover:underline"
                                    href={`${editorBasePath}/${item.id}`}
                                >
                                    {item.title}
                                </Link>
                                {publishedLabel !== null ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Veröffentlicht am {publishedLabel}
                                    </p>
                                ) : metaLabel !== null ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        <code>{metaLabel}</code>
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                            <PublicationStatusBadge status={item.status} />
                            <PublicationRowActions
                                disabled={isBulkBusy}
                                isBusy={isBusy}
                                item={item}
                                onCancelSchedule={onCancelSchedule}
                                onPublish={onPublish}
                                onUnarchive={onUnarchive}
                                onUnpublish={onUnpublish}
                            />
                        </div>
                    </ListPanelRow>
                )
            })}
        </ListPanel>
    )
}
