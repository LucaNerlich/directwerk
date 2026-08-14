'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Button} from '@publish/ui/components/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@publish/ui/components/card'
import EmptyState from '@publish/ui/components/empty-state'
import PageHeader from '@publish/ui/components/page-header'

import {
    createCheckoutSession,
    getSiteConfig,
    listPublicProducts,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {SiteConfig} from '@/lib/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatMoney} from '@/lib/format/money'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface PublicProduct {
    slug: string
    title: string
    offeringType: string
    sortOrder: number
    description: string | null
    priceCents: number | null
    currency: string
    billingInterval: string
}

function readTokenClient(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

function checkoutErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return 'Checkout ist noch nicht verfügbar.'
    }
    if (
        error.message.includes('STRIPE_NOT_IMPLEMENTED') ||
        error.message.includes('STRIPE_NOT_CONNECTED') ||
        error.message.toLowerCase().includes('not implemented')
    ) {
        return 'Online-Zahlung ist noch nicht aktiv. Du kannst das Produkt merken und später zurückkommen — oder die Redaktion schaltet dich im Studio frei.'
    }
    return error.message
}

export default function PricingPage(): React.JSX.Element {
    const router = useRouter()
    const tenantHost = getClientTenantHost()
    const accessToken = useSyncExternalStore(
        subscribeToTokenStore,
        readTokenClient,
        readTokenServer,
    )
    const isAuthenticated = accessToken !== null
    const [products, setProducts] = useState<PublicProduct[]>([])
    const [config, setConfig] = useState<SiteConfig | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busySlug, setBusySlug] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        Promise.all([getSiteConfig(tenantHost), listPublicProducts(tenantHost)])
            .then(([siteConfig, productList]) => {
                if (!active) {
                    return
                }
                setConfig(siteConfig.data)
                setProducts(productList)
                setIsLoading(false)
            })
            .catch((requestError: unknown) => {
                if (!active) {
                    return
                }
                setError(
                    requestError instanceof Error
                        ? requestError.message
                        : 'Preise konnten nicht geladen werden.',
                )
                setIsLoading(false)
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
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.push('/login')
                return
            }
            setCheckoutMessage(checkoutErrorMessage(requestError))
        } finally {
            setBusySlug(null)
        }
    }

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Preise"
                description={
                    <>
                        Wähle eine Mitgliedschaft bei{' '}
                        <strong>{config?.tenant.name ?? '…'}</strong>. Nach der Anmeldung
                        startet der Checkout bei Stripe.
                    </>
                }
            />
            <ol className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                <li className="rounded-xl border bg-card p-4">
                    <strong className="text-foreground">1. Anmelden</strong>
                    <p className="mt-1">Konto auf dieser Domain — ohne fremde Plattform.</p>
                </li>
                <li className="rounded-xl border bg-card p-4">
                    <strong className="text-foreground">2. Produkt wählen</strong>
                    <p className="mt-1">Stufe oder Paket mit Preis — Zahlung über Stripe.</p>
                </li>
                <li className="rounded-xl border bg-card p-4">
                    <strong className="text-foreground">3. Zur Kasse</strong>
                    <p className="mt-1">
                        Danach landest du auf{' '}
                        <Link href="/checkout/success">Erfolg</Link> oder{' '}
                        <Link href="/checkout/cancel">Abbruch</Link>.
                    </p>
                </li>
            </ol>
            {isLoading ? <p>Wird geladen…</p> : null}
            {error !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            {checkoutMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{checkoutMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && error === null ? (
                products.length === 0 ? (
                    <EmptyState
                        title="Noch keine Produkte"
                        description="Veröffentlichte Mitgliedschaften erscheinen hier."
                    />
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {products.map((product) => (
                            <Card key={product.slug}>
                                <CardHeader>
                                    <CardTitle className="text-xl">{product.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    <p>
                                        {product.offeringType === 'LEVEL' ? 'Stufe' : 'Paket'}
                                        {' · '}
                                        {formatMoney(
                                            product.priceCents,
                                            product.currency,
                                            product.billingInterval,
                                        )}
                                    </p>
                                    {product.description !== null && product.description !== '' ? (
                                        <p className="mt-2">{product.description}</p>
                                    ) : null}
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        disabled={busySlug === product.slug}
                                        onClick={() => {
                                            void handleCheckout(product.slug)
                                        }}
                                        type="button"
                                    >
                                        {busySlug === product.slug
                                            ? '…'
                                            : isAuthenticated
                                              ? 'Zur Kasse'
                                              : 'Anmelden & wählen'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )
            ) : null}
            <p>
                <Link href="/register">Registrieren</Link>
                {' · '}
                <Link href="/account">Konto</Link>
                {' · '}
                <Link href="/downloads">Bonusdateien</Link>
            </p>
        </div>
    )
}
