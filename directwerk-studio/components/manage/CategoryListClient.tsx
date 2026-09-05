'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {listCategories} from '@/lib/api/catalogApi'
import type {CategorySummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'

/**
 * Displays and manages the podcast categories for the current organisation.
 *
 * @returns The rendered category management page
 */
export default function CategoryListClient(): React.JSX.Element {
    const {viewMode, setViewMode} = useListViewMode()
    const {data: categories, error: errorMessage, isLoading, reload} = useAuthedQuery<
        CategorySummary[]
    >(() => listCategories(getClientTenantHost()), {
        fallbackError: 'Kategorien konnten nicht geladen werden.',
    })

    const listItems =
        categories?.map((category) => ({
            id: category.id,
            title: category.name,
            href: `/manage/categories/${category.id}`,
            description: (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {category.slug}
                </code>
            ),
            trailing: category.active ? 'Aktiv' : 'Inaktiv',
        })) ?? []

    return (
        <PageStack>
            <PageHeader
                eyebrow="Organisation"
                title="Kategorien"
                description="Optionale Themen-Tags für Folgen und Beiträge — getrennt von Podcast-Formaten. Unterkategorien hängen an genau einer Oberkategorie."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/categories/new" />} size="lg">
                        Neue Kategorie
                    </Button>
                }
            />

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button onClick={reload} size="sm" type="button" variant="outline">
                            Wiederholen
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {isLoading && !errorMessage ? (
                <div className="grid gap-3" aria-busy="true">
                    <p className="text-sm text-muted-foreground" role="status">Laden…</p>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : null}
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
                <EntityListSection
                    items={listItems}
                    linkComponent={Link}
                    onViewModeChange={setViewMode}
                    viewMode={viewMode}
                />
            ) : null}
        </PageStack>
    )
}
