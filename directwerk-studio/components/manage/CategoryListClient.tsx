'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {
    ListPanelLinkItem,
    ListPanelSlugContent,
    listPanelLinkClassName,
} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'

import {listCategories} from '@/lib/api/catalogApi'
import type {CategorySummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'

export default function CategoryListClient(): React.JSX.Element {
    const {data: categories, error: errorMessage, isLoading} = useAuthedQuery<
        CategorySummary[]
    >(() => listCategories(getClientTenantHost()), {
        fallbackError: 'Kategorien konnten nicht geladen werden.',
    })

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Organisation"
                title="Kategorien"
                description="Optionale Themen-Tags für Folgen und Beiträge — getrennt von Podcast-Formaten."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/categories/new" />} size="lg">
                        Neue Kategorie
                    </Button>
                }
            />

            {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
            {isLoading && !errorMessage ? <p>Laden…</p> : null}
            {categories && categories.length === 0 ? (
                <EmptyState
                    title="Noch keine Kategorien"
                    description="Kategorien sind optional. Mit ihnen sortierst du Beiträge und Folgen nach Themen."
                    action={
                        <Button nativeButton={false} render={<Link href="/manage/categories/new" />}>
                            Erste Kategorie anlegen
                        </Button>
                    }
                />
            ) : null}
            {categories && categories.length > 0 ? (
                <ListPanel>
                    {categories.map((category) => (
                        <ListPanelLinkItem key={category.id}>
                            <Link
                                className={listPanelLinkClassName}
                                href={`/manage/categories/${category.id}`}
                            >
                                <ListPanelSlugContent
                                    name={category.name}
                                    slug={category.slug}
                                    trailing={category.active ? 'Aktiv' : 'Inaktiv'}
                                />
                            </Link>
                        </ListPanelLinkItem>
                    ))}
                </ListPanel>
            ) : null}
        </div>
    )
}
