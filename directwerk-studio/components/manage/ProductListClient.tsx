'use client'

import Link from 'next/link'

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
    const levels = products
        .filter((p) => p.offeringType === 'LEVEL')
        .sort((a, b) => a.sortOrder - b.sortOrder)
    const packages = products
        .filter((p) => p.offeringType === 'PACKAGE')
        .sort((a, b) => a.title.localeCompare(b.title))

    const levelItems: EntityListViewItem[] = levels.map((product, index) => ({
        id: product.id,
        title: product.title,
        description: `Stufe ${product.sortOrder} · ${product.slug} · ${formatMoney(product.priceCents, product.currency, product.billingInterval)}`,
        trailing: (
            <Badge variant={product.active ? 'default' : 'outline'}>
                {product.active ? 'Aktiv' : 'Inaktiv'}
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
        description: `${product.slug} · ${formatMoney(product.priceCents, product.currency, product.billingInterval)}`,
        trailing: (
            <Badge variant={product.active ? 'default' : 'outline'}>
                {product.active ? 'Aktiv' : 'Inaktiv'}
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
                        title={`Stufen-Leiter (${levels.length})`}
                        description="Höhere Stufe schließt alle niedrigeren ein — sortiert nach Sortierzahl."
                    />
                    <EntityListView
                        ariaLabel="Mitgliedschaftsstufen"
                        items={levelItems}
                        linkComponent={Link}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}

            {packages.length > 0 ? (
                <section aria-labelledby="product-packages-heading" className="flex flex-col gap-3">
                    <SectionHeader
                        id="product-packages-heading"
                        title={`Pakete (${packages.length})`}
                        description="Schalten nur die Inhalte aus ihren Zugriffsregeln frei."
                    />
                    <EntityListView
                        ariaLabel="Pakete"
                        items={packageItems}
                        linkComponent={Link}
                        viewMode={viewMode}
                    />
                </section>
            ) : null}
        </div>
    )
}

export default function ProductListClient(): React.JSX.Element {
    const tenantHost = getClientTenantHost()
    const {viewMode, setViewMode} = useListViewMode()
    const {data: products, error: errorMessage, isLoading, reload} = useCachedTenantQuery(
        (host) => listProducts(host),
        {
            namespace: 'tenant-products',
            tenantHost,
            fallbackError: 'Produkte konnten nicht geladen werden.',
        },
    )

    return (
        <PageStack>
            <PageHeader
                eyebrow="Abos"
                title="Produkte"
                description="Stufen und Pakete, die Hörerinnen und Hörer kaufen oder die du freischaltest. Der Preis zeigt immer Betrag, Währung und Abrechnungsintervall."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/products/new" />} size="lg">
                        Neues Produkt
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
                <div className="flex flex-col gap-3" aria-busy="true">
                    <p className="text-sm text-muted-foreground" role="status">Laden…</p>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            ) : null}
            {products && products.length === 0 ? (
                <EmptyState
                    title="Noch keine Produkte"
                    description="Lege zuerst ein Abo-Produkt an. Danach kannst du Freischaltungen vergeben und Abonnenten sehen."
                    action={
                        <Button nativeButton={false} render={<Link href="/manage/products/new" />}>
                            Erstes Produkt anlegen
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
