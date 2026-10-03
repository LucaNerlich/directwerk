'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {EntityListToolbar} from '@directwerk/ui/components/entity-list-toolbar'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import type {ViewMode} from '@directwerk/ui/components/view-mode-toggle'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {listProducts} from '@/lib/api/subscriptionApi'
import type {SubscriptionProduct} from '@directwerk/api/types'
import {useCachedTenantQuery} from '@directwerk/api/client/useCachedTenantQuery'
import {formatMoney} from '@directwerk/api/format'
import {getClientTenantHost} from '@directwerk/api/tenant'

function ProductGroups({
    products,
    viewMode,
    onViewModeChange,
}: {
    products: SubscriptionProduct[]
    viewMode: ViewMode
    onViewModeChange: (mode: ViewMode) => void
}): React.JSX.Element {
    const dict = useDictionary()
    const m = dict.manage
    const levels = products
        .filter((product) => product.offeringType === 'LEVEL')
        .sort((a, b) => a.sortOrder - b.sortOrder)
    const packages = products
        .filter((product) => product.offeringType === 'PACKAGE')
        .sort((a, b) => a.title.localeCompare(b.title))

    const levelItems: EntityListViewItem[] = levels.map((product, index) => ({
        id: product.id,
        title: product.title,
        description: t(m.productMetaLine, {
            sortOrder: product.sortOrder,
            slug: product.slug,
            price: formatMoney(product.priceCents, product.currency, product.billingInterval),
        }),
        trailing: (
            <Badge variant={product.active ? 'default' : 'outline'}>
                {product.active ? dict.common.active : dict.common.inactive}
            </Badge>
        ),
        href: `/manage/products/${product.id}`,
        leading: (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold tabular-nums">
                {index + 1}
            </span>
        ),
    }))

    const packageItems: EntityListViewItem[] = packages.map((product) => ({
        id: product.id,
        title: product.title,
        description: t(m.packageMetaLine, {
            slug: product.slug,
            price: formatMoney(product.priceCents, product.currency, product.billingInterval),
        }),
        trailing: (
            <Badge variant={product.active ? 'default' : 'outline'}>
                {product.active ? dict.common.active : dict.common.inactive}
            </Badge>
        ),
        href: `/manage/products/${product.id}`,
    }))

    return (
        <div className="flex flex-col gap-8">
            <EntityListToolbar
                onViewModeChange={onViewModeChange}
                showSelection={false}
                viewMode={viewMode}
            />
            {levels.length > 0 ? (
                <section aria-labelledby="product-levels-heading" className="flex flex-col gap-3">
                    <SectionHeader
                        id="product-levels-heading"
                        title={t(m.stufenLeiter, {'levels.length': levels.length})}
                        description={m.hoehereStufeSchliesstAlleNiedrigerenSortier}
                    />
                    <EntityListView
                        ariaLabel={m.membershipLevelsAria}
                        items={levelItems}
                        linkComponent={LocaleLink}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}

            {packages.length > 0 ? (
                <section aria-labelledby="product-packages-heading" className="flex flex-col gap-3">
                    <SectionHeader
                        id="product-packages-heading"
                        title={t(m.pakete, {'packages.length': packages.length})}
                        description={m.schaltenInhalteIhrenZugriffsregelnFrei}
                    />
                    <EntityListView
                        ariaLabel={m.packagesAria}
                        items={packageItems}
                        linkComponent={LocaleLink}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}
        </div>
    )
}

export default function ProductListClient(): React.JSX.Element {
    const dict = useDictionary()
    const m = dict.manage
    const tenantHost = getClientTenantHost()
    const {viewMode, setViewMode} = useListViewMode()
    const {data: products, error: errorMessage, isLoading, reload} = useCachedTenantQuery(
        (host) => listProducts(host),
        {
            namespace: 'tenant-products',
            tenantHost,
            fallbackError: m.produkteKonntenGeladen,
        },
    )

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.subscriptions}
                title={m.productsTitle}
                description={m.stufenPaketeHoererinnenHoererKaufenFreischa}
                actions={
                    <Button nativeButton={false} render={<LocaleLink href="/manage/products/new" />} size="lg">
                        {m.neuesProdukt}
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
                <div className="flex flex-col gap-3" aria-busy="true">
                    <p className="text-sm text-muted-foreground" role="status">{dict.common.loadingShort}</p>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : null}
            {products && products.length === 0 ? (
                <EmptyState
                    title={m.keineProdukte}
                    description={m.legeZuerstAboProduktDanachKannst}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/manage/products/new" />}>
                            {m.createFirstProduct}
                        </Button>
                    }
                />
            ) : null}
            {products && products.length > 0 ? (
                <ProductGroups
                    onViewModeChange={setViewMode}
                    products={products}
                    viewMode={viewMode}
                />
            ) : null}
        </PageStack>
    )
}
