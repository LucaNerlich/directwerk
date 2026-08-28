'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState, useSyncExternalStore} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import StatCard from '@directwerk/ui/components/stat-card'

import {
    createCheckoutSession,
    getSiteConfig,
    listPublicLevels,
    listPublicProducts,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {LevelSummary, PublicSiteConfig} from '@directwerk/api/types'
import {
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {formatMoney} from '@/lib/format/money'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'
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
    const [levels, setLevels] = useState<LevelSummary[]>([])
    const [config, setConfig] = useState<PublicSiteConfig | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busySlug, setBusySlug] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        Promise.all([
            getSiteConfig(tenantHost),
            listPublicProducts(tenantHost),
            listPublicLevels(tenantHost),
        ])
            .then(([siteConfig, productList, levelList]) => {
                if (!active) {
                    return
                }
                setConfig(siteConfig.data)
                setProducts(productList)
                setLevels(levelList)
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
            router.push(`/login?returnTo=${encodeURIComponent('/pricing')}`)
            return
        }

        setBusySlug(productSlug)
        try {
            const checkoutUrl = await createCheckoutSession(tenantHost, productSlug)
            if (checkoutUrl !== null) {
                window.location.assign(checkoutUrl)
                return
            }
            // A missing/invalid URL is an API contract violation, not a completed
            // payment or grant — never route to the "payment received" screen.
            setCheckoutMessage(
                'Es konnte keine gültige Checkout-Adresse erstellt werden. '
                    + 'Bitte versuche es später erneut oder wende dich an die Redaktion.',
            )
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.push(`/login?returnTo=${encodeURIComponent('/pricing')}`)
                return
            }
            setCheckoutMessage(userFacingBillingError(requestError, 'checkout'))
        } finally {
            setBusySlug(null)
        }
    }

    return (
        <PageStack className="page-container">
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
            <section className="grid gap-3 sm:grid-cols-3">
                <StatCard
                    hint="Konto auf dieser Domain — ohne fremde Plattform."
                    label="Schritt 1"
                    value="Anmelden"
                />
                <StatCard
                    hint="Stufe oder Paket mit Preis — Zahlung über Stripe."
                    label="Schritt 2"
                    value="Produkt wählen"
                />
                <StatCard
                    footer={
                        <>
                            Danach landest du auf{' '}
                            <Link href="/checkout/success">Erfolg</Link> oder{' '}
                            <Link href="/checkout/cancel">Abbruch</Link>.
                        </>
                    }
                    label="Schritt 3"
                    value="Zur Kasse"
                />
            </section>
            {isLoading ? <p className="text-sm text-muted-foreground">Wird geladen…</p> : null}
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
            {!isLoading && levels.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description="Höhere Stufen schalten mehr bezahlte Folgen frei (sortiert nach Rang)."
                        title="Stufen"
                    />
                    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {levels.map((level) => (
                            <li key={level.id}>
                                <StatCard
                                    hint={`Rang ${level.sortOrder} · ${level.slug}`}
                                    label="Stufe"
                                    value={level.title}
                                />
                            </li>
                        ))}
                    </ol>
                </section>
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
            <p className="text-sm text-muted-foreground">
                <Link href="/register">Registrieren</Link>
                {' · '}
                <Link href="/account">Konto</Link>
                {' · '}
                <Link href="/downloads">Bonusdateien</Link>
            </p>
        </PageStack>
    )
}
