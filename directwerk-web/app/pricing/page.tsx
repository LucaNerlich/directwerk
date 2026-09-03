'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useCallback, useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardFooter, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import StatCard from '@directwerk/ui/components/stat-card'

import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {
    createCheckoutSession,
    listPublicLevels,
    listPublicProducts,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {LevelSummary, PublicProduct} from '@directwerk/api/types'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {formatMoney} from '@directwerk/api/format'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@/lib/tenant/clientHost'

function PricingContent(): React.JSX.Element {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pendingBuy = searchParams.get('buy') ?? ''
    const tenantHost = getClientTenantHost()
    const config = useSiteConfig()
    const {isAuthenticated} = useSubscriberAuth()
    const [products, setProducts] = useState<PublicProduct[]>([])
    const [levels, setLevels] = useState<LevelSummary[]>([])
    const [error, setError] = useState<string | null>(null)
    const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busySlug, setBusySlug] = useState<string | null>(null)
    const resumedBuyRef = useRef(false)

    useEffect(() => {
        let active = true
        Promise.all([
            listPublicProducts(tenantHost),
            listPublicLevels(tenantHost),
        ])
            .then(([productList, levelList]) => {
                if (!active) {
                    return
                }
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

    const handleCheckout = useCallback(
        async (productSlug: string): Promise<void> => {
            setCheckoutMessage(null)
            if (!isAuthenticated) {
                router.push(
                    `/login?returnTo=${encodeURIComponent(`/pricing?buy=${encodeURIComponent(productSlug)}`)}`,
                )
                return
            }

            setBusySlug(productSlug)
            try {
                const checkoutUrl = await createCheckoutSession(tenantHost, productSlug)
                if (checkoutUrl !== null) {
                    window.location.assign(checkoutUrl)
                    return
                }
                setCheckoutMessage(
                    'Es konnte keine gültige Checkout-Adresse erstellt werden. '
                        + 'Bitte versuche es später erneut oder wende dich an die Redaktion.',
                )
            } catch (requestError: unknown) {
                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.push(
                        `/login?returnTo=${encodeURIComponent(`/pricing?buy=${encodeURIComponent(productSlug)}`)}`,
                    )
                    return
                }
                setCheckoutMessage(userFacingBillingError(requestError, 'checkout'))
            } finally {
                setBusySlug(null)
            }
        },
        [isAuthenticated, router, tenantHost],
    )

    // A product chosen before login is preserved through auth via
    // `?buy=<slug>` and resumed automatically once the session exists.
    useEffect(() => {
        if (
            resumedBuyRef.current ||
            isLoading ||
            !isAuthenticated ||
            pendingBuy.length === 0
        ) {
            return
        }
        resumedBuyRef.current = true
        const known = products.some((product) => product.slug === pendingBuy)
        router.replace('/pricing')
        if (known) {
            void handleCheckout(pendingBuy)
        } else {
            setCheckoutMessage(
                'Das gewählte Produkt ist nicht mehr verfügbar. Bitte wähle ein anderes.',
            )
        }
    }, [handleCheckout, isAuthenticated, isLoading, pendingBuy, products, router])

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Preise"
                description={
                    <>
                        Wähle eine Mitgliedschaft bei{' '}
                        <strong>{config.tenant.name}</strong>. Nach der Anmeldung
                        startet der Checkout bei Stripe.
                    </>
                }
            />
            <SubscriberContextBanner showWhenAuthenticated={false} />

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
            {isLoading ? (
                <div role="status" aria-busy="true" aria-label="Preise werden geladen">
                    <CardGridSkeleton cards={3} columns={3} />
                </div>
            ) : null}
            {error !== null ? (
                <Alert variant="destructive" role="alert">
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
                                    hint={`Rang ${level.sortOrder}`}
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
                            <Card key={product.slug} className="flex flex-col">
                                <CardHeader className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">
                                            {product.offeringType === 'LEVEL' ? 'Stufe' : 'Paket'}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl">{product.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 text-sm text-muted-foreground">
                                    <p className="text-lg font-semibold text-foreground">
                                        {formatMoney(
                                            product.priceCents,
                                            product.currency,
                                            product.billingInterval,
                                            {nullLabel: 'Preis folgt'},
                                        )}
                                    </p>
                                    {product.description !== null && product.description !== '' ? (
                                        <p className="mt-3 leading-6">{product.description}</p>
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

export default function PricingPage(): React.JSX.Element {
    return (
        <Suspense
            fallback={
                <PageStack className="page-container">
                    <div role="status" aria-busy="true" aria-label="Preise werden geladen">
                        <CardGridSkeleton cards={3} columns={3} />
                    </div>
                </PageStack>
            }
        >
            <PricingContent />
        </Suspense>
    )
}
