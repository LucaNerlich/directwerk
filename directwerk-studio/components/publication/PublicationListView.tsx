'use client'

import type {ReactNode} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {EntityListView} from '@directwerk/ui/components/entity-list-view'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'

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

function toPublicationEntityItems<T extends PublicationListItem>({
    items,
    editorBasePath,
    viewMode,
    busyItemId,
    isBulkBusy,
    onPublish,
    onUnpublish,
    onCancelSchedule,
    onUnarchive,
}: {
    items: T[]
    editorBasePath: string
    viewMode: PublicationListViewMode
    busyItemId: number | null
    isBulkBusy: boolean
    onPublish: (item: T) => void
    onUnpublish: (item: T) => void
    onCancelSchedule: (item: T) => void
    onUnarchive: (item: T) => void
}): EntityListViewItem[] {
    return items.map((item) => {
        const isBusy = busyItemId === item.id
        const publishedLabel = formatPublishedAt(item.publishedAt)
        const descriptions: ReactNode[] = []

        if (publishedLabel !== null) {
            descriptions.push(`Veröffentlicht am ${publishedLabel}`)
        }
        if (item.meta !== undefined && item.meta !== null) {
            descriptions.push(<code key="meta">{item.meta}</code>)
        }

        const statusBadge = <PublicationStatusBadge status={item.status} />

        return {
            id: item.id,
            title: item.title,
            href: `${editorBasePath}/${item.id}`,
            descriptions,
            trailing: viewMode === 'list' ? statusBadge : undefined,
            extra: viewMode === 'grid' ? statusBadge : undefined,
            actions: (
                <PublicationRowActions
                    disabled={isBulkBusy}
                    isBusy={isBusy}
                    item={item}
                    onCancelSchedule={onCancelSchedule}
                    onPublish={onPublish}
                    onUnarchive={onUnarchive}
                    onUnpublish={onUnpublish}
                />
            ),
        }
    })
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
    const entityItems = toPublicationEntityItems({
        items,
        editorBasePath,
        viewMode,
        busyItemId,
        isBulkBusy,
        onPublish,
        onUnpublish,
        onCancelSchedule,
        onUnarchive,
    })

    return (
        <EntityListView
            disabled={isBulkBusy}
            items={entityItems}
            onToggleSelection={(id) => onToggleSelection(id as number)}
            selectable
            selectedIds={selectedIds}
            viewMode={viewMode}
        />
    )
}
