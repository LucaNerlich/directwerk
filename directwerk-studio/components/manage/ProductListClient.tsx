'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {listProducts} from '@/lib/api/tenantApi'
import type {SubscriptionProduct} from '@/lib/api/types'
import {formatMoney} from '@/lib/format/money'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export default function ProductListClient(): React.JSX.Element {
    const router = useRouter()
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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
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
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {products.map((product) => (
                        <li key={product.id}>
                            <Link
                                className="flex w-full items-center justify-between gap-4 p-4 text-sm no-underline hover:bg-muted/40"
                                href={`/manage/products/${product.id}`}
                            >
                                <span>
                                    <span className="font-medium">{product.title}</span>
                                    <br />
                                    <small className="text-muted-foreground">
                                        {product.slug} · {product.offeringType} ·{' '}
                                        {formatMoney(
                                            product.priceCents,
                                            product.currency,
                                            product.billingInterval,
                                        )}
                                    </small>
                                </span>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    {product.active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
