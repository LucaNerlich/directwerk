'use client'

import {EntityListSection} from '#components/entity-list-section'
import {EntityListView, type EntityListViewItem} from '#components/entity-list-view'
import type {ViewMode} from '#components/view-mode-toggle'

export interface SlugEntityListItem {
    id: number
    name: string
    slug: string
    trailing?: string
    href: string
}

export function mapSlugEntityListItems(items: SlugEntityListItem[]): EntityListViewItem[] {
    return items.map((item) => ({
        id: item.id,
        title: item.name,
        href: item.href,
        description: <code>{item.slug}</code>,
        trailing: item.trailing,
    }))
}

export function SlugEntityListView({
    items,
    viewMode,
}: {
    items: SlugEntityListItem[]
    viewMode: ViewMode
}): React.JSX.Element {
    return <EntityListView items={mapSlugEntityListItems(items)} viewMode={viewMode} />
}

export function SlugEntityListSection({
    items,
    viewMode,
    onViewModeChange,
}: {
    items: SlugEntityListItem[]
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
}): React.JSX.Element {
    return (
        <EntityListSection
            items={mapSlugEntityListItems(items)}
            onViewModeChange={onViewModeChange}
            showSelection={false}
            viewMode={viewMode}
        />
    )
}
