'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {listProducts} from '@/lib/api/tenantApi'
import type {SubscriptionProduct} from '@directwerk/api/types'
import {formatMoney} from '@/lib/format/money'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function ProductGroups({products}: {products: SubscriptionProduct[]}): React.JSX.Element {
    const levels = products
        .filter((p) => p.offeringType === 'LEVEL')
        .sort((a, b) => a.sortOrder - b.sortOrder)
    const packages = products
        .filter((p) => p.offeringType === 'PACKAGE')
        .sort((a, b) => a.title.localeCompare(b.title))

    return (
        <div className="flex flex-col gap-8">
            {levels.length > 0 ? (
                <section>
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
                        Stufen-Leiter
                    </h2>
                    <ol className="relative overflow-hidden rounded-xl border bg-card divide-y">
                        {levels.map((product, index) => (
                            <li key={product.id} className="relative">
                                <Link
                                    className="flex w-full items-center gap-4 p-4 text-sm no-underline hover:bg-muted/40"
                                    href={`/manage/products/${product.id}`}
                                >
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-bold tabular-nums">
                                        {index + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="font-medium">{product.title}</span>
                                        <br />
                                        <small className="text-muted-foreground">
                                            Stufe {product.sortOrder} · {product.slug} ·{' '}
                                            {formatMoney(
                                                product.priceCents,
                                                product.currency,
                                                product.billingInterval,
                                            )}
                                        </small>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                                        {product.active ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ol>
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
                    <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                        {packages.map((product) => (
                            <li key={product.id}>
                                <Link
                                    className="flex w-full items-center justify-between gap-4 p-4 text-sm no-underline hover:bg-muted/40"
                                    href={`/manage/products/${product.id}`}
                                >
                                    <span>
                                        <span className="font-medium">{product.title}</span>
                                        <br />
                                        <small className="text-muted-foreground">
                                            {product.slug} ·{' '}
                                            {formatMoney(
                                                product.priceCents,
                                                product.currency,
                                                product.billingInterval,
                                            )}
                                        </small>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                                        {product.active ? 'Aktiv' : 'Inaktiv'}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
        </div>
    )
}

export default function ProductListClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [products, setProducts] = useState<SubscriptionProduct[] | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        listProducts(getClientTenantHost())
            .then((result) => {
                if (active) {
                    setProducts(result)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Produkte konnten nicht geladen werden.',
                )
            })

        return () => {
            active = false
        }
    }, [router])

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
            {products === null && !errorMessage ? <p>Laden…</p> : null}
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
                <ProductGroups products={products} />
            ) : null}
        </div>
    )
}
