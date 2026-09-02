'use client'

import type {ReactNode} from 'react'
import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import type {ViewMode} from '@directwerk/ui/components/view-mode-toggle'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import TagPill from '@/components/publication/TagPill'
import {isBulkPublicationStatus} from '@/lib/publication/publicationBulkEligibility'
import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationListItem {
    id: number
    title: string
    status: PublicationStatus
    publishedAt: string | null
    meta?: string | null
    formats?: {id: number; name: string}[]
    categories?: {id: number; name: string}[]
    seriesLabel?: string | null
    episodeNumber?: number | null
}

interface PublicationListSectionProps<T extends PublicationListItem> {
    items: T[]
    editorBasePath: string
    contentLabelPlural: string
    selectedIds: ReadonlySet<number>
    allSelected: boolean
    viewMode: ViewMode
    publishableCount: number
    unpublishableCount: number
    isBulkBusy: boolean
    busyItemId: number | null
    onToggleSelectAll: () => void
    onViewModeChange: (mode: ViewMode) => void
    onBulkPublish: () => void
    onBulkUnpublish: () => void
    onToggleSelection: (id: number) => void
    onPublish: (item: T) => void
    onUnpublish: (item: T) => void
    onCancelSchedule?: (item: T) => void
    onUnarchive?: (item: T) => void
    /** Non-null disables the row's publish action, shows the reason, and excludes drafts from bulk selection. */
    publishBlockedReason?: (item: T) => string | null
    onBulkEdit?: () => void
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
    publishBlockedReason,
    onPublish,
    onUnpublish,
    onCancelSchedule,
    onUnarchive,
}: {
    item: T
    isBusy: boolean
    disabled: boolean
    publishBlockedReason?: string | null
    onPublish: (item: T) => void
    onUnpublish: (item: T) => void
    onCancelSchedule?: (item: T) => void
    onUnarchive?: (item: T) => void
}): React.JSX.Element {
    const publishBlocked = publishBlockedReason !== undefined && publishBlockedReason !== null
    return (
        <>
            {item.status === 'DRAFT' ? (
                <>
                    {publishBlocked ? (
                        <span className="text-xs text-muted-foreground">{publishBlockedReason}</span>
                    ) : null}
                    <Button
                        disabled={disabled || isBusy || publishBlocked}
                        onClick={() => void onPublish(item)}
                        size="sm"
                        type="button"
                    >
                        {isBusy ? 'Wird veröffentlicht…' : 'Veröffentlichen'}
                    </Button>
                </>
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
            {item.status === 'SCHEDULED' && onCancelSchedule !== undefined ? (
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
            {item.status === 'ARCHIVED' && onUnarchive !== undefined ? (
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

function toEntityItems<T extends PublicationListItem>({
    items,
    editorBasePath,
    viewMode,
    busyItemId,
    isBulkBusy,
    publishBlockedReason,
    onPublish,
    onUnpublish,
    onCancelSchedule,
    onUnarchive,
}: Pick<
    PublicationListSectionProps<T>,
    | 'items'
    | 'editorBasePath'
    | 'viewMode'
    | 'busyItemId'
    | 'isBulkBusy'
    | 'publishBlockedReason'
    | 'onPublish'
    | 'onUnpublish'
    | 'onCancelSchedule'
    | 'onUnarchive'
>): EntityListViewItem<number>[] {
    return items.map((item) => {
        const publishedLabel = formatPublishedAt(item.publishedAt)
        const descriptions: ReactNode[] = []

        const pills = [
            ...(item.formats ?? []).map((format) => (
                <TagPill key={`format-${format.id}`} name={format.name} />
            )),
            ...(item.categories ?? []).map((category) => (
                <TagPill key={`category-${category.id}`} name={category.name} />
            )),
        ]
        if (pills.length > 0) {
            descriptions.push(
                <div className="flex flex-wrap gap-1" key="tags">
                    {pills}
                </div>,
            )
        }

        if (publishedLabel !== null) {
            descriptions.push(`Veröffentlicht am ${publishedLabel}`)
        }

        const metaParts: string[] = []
        if (item.episodeNumber !== undefined && item.episodeNumber !== null) {
            metaParts.push(`#${item.episodeNumber}`)
        }
        if (item.meta !== undefined && item.meta !== null) {
            metaParts.push(item.meta)
        }
        if (item.seriesLabel !== undefined && item.seriesLabel !== null) {
            metaParts.push(item.seriesLabel)
        }
        if (metaParts.length > 0) {
            descriptions.push(<code key="meta">{metaParts.join(' · ')}</code>)
        }

        const blockedReason = publishBlockedReason?.(item) ?? null
        const statusBadge = <PublicationStatusBadge status={item.status} />

        return {
            id: item.id,
            title: item.title,
            href: `${editorBasePath}/${item.id}`,
            descriptions,
            selectionDisabled:
                !isBulkPublicationStatus(item.status) ||
                (item.status === 'DRAFT' && blockedReason !== null),
            trailing: viewMode === 'list' ? statusBadge : undefined,
            extra: viewMode === 'grid' ? statusBadge : undefined,
            actions: (
                <PublicationRowActions
                    disabled={isBulkBusy}
                    isBusy={busyItemId === item.id}
                    item={item}
                    publishBlockedReason={blockedReason}
                    onCancelSchedule={onCancelSchedule}
                    onPublish={onPublish}
                    onUnarchive={onUnarchive}
                    onUnpublish={onUnpublish}
                />
            ),
        }
    })
}

export default function PublicationListSection<T extends PublicationListItem>(
    props: PublicationListSectionProps<T>,
): React.JSX.Element {
    const {
        allSelected,
        contentLabelPlural,
        isBulkBusy,
        onBulkEdit,
        onBulkPublish,
        onBulkUnpublish,
        onToggleSelectAll,
        onToggleSelection,
        onViewModeChange,
        publishableCount,
        selectedIds,
        unpublishableCount,
        viewMode,
    } = props

    return (
        <EntityListSection
            allSelected={allSelected}
            bulkActions={
                <>
                    {publishableCount > 0 ? (
                        <Button
                            disabled={isBulkBusy}
                            onClick={() => void onBulkPublish()}
                            size="sm"
                            type="button"
                        >
                            {isBulkBusy
                                ? 'Wird veröffentlicht…'
                                : `${publishableCount} veröffentlichen`}
                        </Button>
                    ) : null}
                    {unpublishableCount > 0 ? (
                        <Button
                            disabled={isBulkBusy}
                            onClick={() => void onBulkUnpublish()}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {isBulkBusy
                                ? 'Wird zurückgezogen…'
                                : `${unpublishableCount} zurückziehen`}
                        </Button>
                    ) : null}
                    {onBulkEdit !== undefined && selectedIds.size > 0 ? (
                        <Button
                            disabled={isBulkBusy}
                            onClick={onBulkEdit}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Bearbeiten…
                        </Button>
                    ) : null}
                </>
            }
            disabled={isBulkBusy}
            items={toEntityItems(props)}
            linkComponent={Link}
            onToggleSelectAll={onToggleSelectAll}
            onToggleSelection={onToggleSelection}
            onViewModeChange={onViewModeChange}
            selectAllLabel={`Alle ${contentLabelPlural} auswählen`}
            selectedIds={selectedIds}
            selectable
            viewMode={viewMode}
        />
    )
}
