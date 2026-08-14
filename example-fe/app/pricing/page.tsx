'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {createCheckoutSession, listPublicProducts} from '@/lib/api/client'
import {formatMoney} from '@/lib/format/money'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PublicProduct} from '@/lib/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function PricingPage(): React.JSX.Element {
    const router = useRouter()
    const tenantHost = useSelectedTenant()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const [products, setProducts] = useState<PublicProduct[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busySlug, setBusySlug] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        listPublicProducts(tenantHost)
            .then((list) => {
                if (active) {
                    setProducts(list)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setProducts([])
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load products.',
                )
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [tenantHost])

    async function handleCheckout(productSlug: string): Promise<void> {
        setCheckoutMessage(null)
        if (!isAuthenticated) {
            router.push('/login')
            return
        }
        setBusySlug(productSlug)
        try {
            const checkoutUrl = await createCheckoutSession(tenantHost, productSlug)
            if (checkoutUrl !== null) {
                window.location.assign(checkoutUrl)
                return
            }
            router.push('/checkout/success')
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.push('/login')
                return
            }
            const message = error instanceof Error ? error.message : 'Checkout failed.'
            setCheckoutMessage(
                message.toLowerCase().includes('not implemented')
                    ? 'Stripe is not configured on this API (501). Use studio grants for local entitlement tests.'
                    : message,
            )
        } finally {
            setBusySlug(null)
        }
    }

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Pricing"
                description={
                    <span>
                        Public subscription products (LEVEL / PACKAGE). Checkout opens
                        Stripe when billing is live, then{' '}
                        <Link href="/checkout/success">/checkout/success</Link>. Tenant:{' '}
                        <code>{tenantHost}</code>
                    </span>
                }
            />
            {isLoading ? <p>Loading…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {checkoutMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{checkoutMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && products.length === 0 ? (
                <EmptyState
                    title="No products yet"
                    description="Create LEVEL or PACKAGE products in directwerk-studio under Abos."
                />
            ) : null}
            {!isLoading && products.length > 0 ? (
                <ul className="space-y-3">
                    {products.map((product) => (
                        <li
                            key={product.slug}
                            className="rounded-xl border bg-card p-4"
                        >
                            <h2 className="text-lg font-semibold">{product.title}</h2>
                            <p className="text-sm text-muted-foreground">
                                {product.offeringType}
                                {' · '}
                                {formatMoney(
                                    product.priceCents,
                                    product.currency,
                                    product.billingInterval,
                                )}
                                {' · '}
                                <code>{product.slug}</code>
                            </p>
                            <Button
                                className="mt-3"
                                disabled={busySlug === product.slug}
                                onClick={() => {
                                    void handleCheckout(product.slug)
                                }}
                                type="button"
                            >
                                {busySlug === product.slug
                                    ? '…'
                                    : isAuthenticated
                                      ? 'Start checkout'
                                      : 'Sign in to checkout'}
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {accessToken === null ? (
                <p className="text-sm text-muted-foreground">
                    <Link href="/login">Sign in</Link> to review your access on{' '}
                    <Link href="/account">Account</Link>.
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    See active levels, packages, and subscriptions on{' '}
                    <Link href="/account">Account</Link>
                    {' · '}
                    <Link href="/downloads">Downloads</Link>.
                </p>
            )}
        </div>
    )
}
