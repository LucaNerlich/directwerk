'use client'

import {EntityListSection} from '#components/entity-list-section'
import type {EntityListViewItem} from '#components/entity-list-view'
import type {ViewMode} from '#components/view-mode-toggle'

export interface SlugEntityListItem {
    id: number
    name: string
    slug: string
    trailing?: string
    href: string
}

function mapSlugEntityListItems(
    items: SlugEntityListItem[],
): EntityListViewItem<number>[] {
    return items.map((item) => ({
        id: item.id,
        title: item.name,
        href: item.href,
        description: <code>{item.slug}</code>,
        trailing: item.trailing,
    }))
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
            viewMode={viewMode}
        />
    )
}
