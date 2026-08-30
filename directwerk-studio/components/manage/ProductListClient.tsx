'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
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
        trailing: product.active ? 'Aktiv' : 'Inaktiv',
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
        trailing: product.active ? 'Aktiv' : 'Inaktiv',
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
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                        Stufen-Leiter
                    </h2>
                    <EntityListView
                        ariaLabel="Mitgliedschaftsstufen"
                        items={levelItems}
                        linkComponent={Link}
                        viewMode={viewMode}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                        Höhere Stufe schließt alle niedrigeren ein.
                    </p>
                </section>
            ) : null}

            {packages.length > 0 ? (
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                        Pakete
                    </h2>
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
    const {data: products, error: errorMessage, isLoading} = useCachedTenantQuery(
        (host) => listProducts(host),
        {
            namespace: 'tenant-products',
            tenantHost,
            fallbackError: 'Produkte konnten nicht geladen werden.',
        },
    )

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Abos"
                title="Produkte"
                description="Stufen und Pakete, die Hörerinnen und Hörer kaufen oder die du freischaltest."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/products/new" />} size="lg">
                        Neues Produkt
                    </Button>
                }
            />

            {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
            {isLoading && !errorMessage ? <p>Laden…</p> : null}
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
        </div>
    )
}
