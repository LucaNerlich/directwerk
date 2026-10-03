'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'

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

export default function CategoryListClient(): React.JSX.Element {
    const dict = useDictionary()
    const m = dict.manage
    const {viewMode, setViewMode} = useListViewMode()
    const {data: categories, error: errorMessage, isLoading, reload} = useAuthedQuery<
        CategorySummary[]
    >(() => listCategories(getClientTenantHost()), {
        fallbackError: m.kategorienKonntenGeladen,
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
            trailing: category.active ? dict.common.active : dict.common.inactive,
        })) ?? []

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.organisation}
                title={m.categoriesTitle}
                description={m.optionaleThemenTagsFolgenBeitraegeGetrennt}
                actions={
                    <Button nativeButton={false} render={<LocaleLink href="/manage/categories/new" />} size="lg">
                        {m.neueKategorie}
                    </Button>
                }
            />

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button onClick={reload} size="sm" type="button" variant="outline">
                            {dict.common.retryShort}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {isLoading && !errorMessage ? (
                <div className="grid gap-3" aria-busy="true">
                    <p className="text-sm text-muted-foreground" role="status">{dict.common.loadingShort}</p>
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : null}
            {categories && categories.length === 0 ? (
                <EmptyState
                    title={m.keineKategorien}
                    description={m.kategorienOptionalIhnenSortierstBeitraege}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/manage/categories/new" />}>
                            {m.createFirstCategory}
                        </Button>
                    }
                />
            ) : null}
            {categories && categories.length > 0 ? (
                <EntityListSection
                    items={listItems}
                    linkComponent={LocaleLink}
                    onViewModeChange={setViewMode}
                    viewMode={viewMode}
                />
            ) : null}
        </PageStack>
    )
}
