'use client'

import ListPanel, {
    ListPanelLinkItem,
    ListPanelSlugContent,
    listPanelLinkClassName,
} from '#components/list-panel'
import {Card, CardContent, CardHeader, CardTitle} from '#components/card'
import type {ViewMode} from '#components/view-mode-toggle'

export interface SlugEntityListItem {
    id: number
    name: string
    slug: string
    trailing?: string
    href: string
}

export function SlugEntityListView({
    items,
    viewMode,
}: {
    items: SlugEntityListItem[]
    viewMode: ViewMode
}): React.JSX.Element {
    if (viewMode === 'grid') {
        return (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                    <li key={item.id}>
                        <Card className="h-full" size="sm">
                            <CardHeader>
                                <CardTitle className="min-w-0">
                                    <a
                                        className="line-clamp-2 hover:underline"
                                        href={item.href}
                                    >
                                        {item.name}
                                    </a>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                                <code>{item.slug}</code>
                                {item.trailing !== undefined ? (
                                    <span>{item.trailing}</span>
                                ) : null}
                            </CardContent>
                        </Card>
                    </li>
                ))}
            </ul>
        )
    }

    return (
        <ListPanel>
            {items.map((item) => (
                <ListPanelLinkItem key={item.id}>
                    <a className={listPanelLinkClassName} href={item.href}>
                        <ListPanelSlugContent
                            name={item.name}
                            slug={item.slug}
                            trailing={item.trailing}
                        />
                    </a>
                </ListPanelLinkItem>
            ))}
        </ListPanel>
    )
}
