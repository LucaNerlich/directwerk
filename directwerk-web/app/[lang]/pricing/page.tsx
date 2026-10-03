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
import {formatMoney} from '@/lib/format/money'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'
import {interpolate} from '@/lib/i18n/interpolate'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

function PricingContent(): React.JSX.Element {
    const lang = useLocale()
    const {billing, common, errors, format} = useDictionary()
    const router = useRouter()
    const searchParams = useSearchParams()
    const pendingBuy = searchParams.get('buy') ?? ''
    const tenantHost = getWebClientTenantHost()
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
                        : errors.pricingLoadFailed,
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [errors.pricingLoadFailed, tenantHost])

    const handleCheckout = useCallback(
        async (productSlug: string): Promise<void> => {
            setCheckoutMessage(null)
            if (!isAuthenticated) {
                router.push(
                    `${localizedPath(lang, '/login')}?returnTo=${encodeURIComponent(localizedPath(lang, `/pricing?buy=${encodeURIComponent(productSlug)}`))}`,
                )
                return
            }

            // Products without a price are not sellable yet — the button is
            // disabled, but the resumed `?buy=` flow must not slip past it.
            const product = products.find((item) => item.slug === productSlug)
            if (product !== undefined && product.priceCents === null) {
                setCheckoutMessage(billing.productNotPurchasable)
                return
            }

            setBusySlug(productSlug)
            try {
                const checkoutUrl = await createCheckoutSession(tenantHost, productSlug)
                if (checkoutUrl !== null) {
                    window.location.assign(checkoutUrl)
                    return
                }
                setCheckoutMessage(billing.checkoutUrlInvalid)
            } catch (requestError: unknown) {
                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.push(
                        `${localizedPath(lang, '/login')}?returnTo=${encodeURIComponent(localizedPath(lang, `/pricing?buy=${encodeURIComponent(productSlug)}`))}`,
                    )
                    return
                }
                setCheckoutMessage(userFacingBillingError(requestError, 'checkout', errors))
            } finally {
                setBusySlug(null)
            }
        },
        [billing, errors, isAuthenticated, lang, products, router, tenantHost],
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
        router.replace(localizedPath(lang, '/pricing'))
        if (known) {
            void handleCheckout(pendingBuy)
        } else {
            setCheckoutMessage(billing.productUnavailable)
        }
    }, [
        billing.productUnavailable,
        handleCheckout,
        isAuthenticated,
        isLoading,
        lang,
        pendingBuy,
        products,
        router,
    ])

    const hasLevelProducts = products.some(
        (product) => product.offeringType === 'LEVEL',
    )

    return (
        <PageStack className="page-container">
            <PageHeader
                title={billing.title}
                description={
                    <>
                        {billing.descriptionBefore}
                        <strong>{config.tenant.name}</strong>
                        {billing.descriptionAfter}
                    </>
                }
            />
            <SubscriberContextBanner showWhenAuthenticated={false} />

            <section className="grid gap-3 sm:grid-cols-3">
                <StatCard
                    hint={billing.step1Hint}
                    label={billing.step1Label}
                    value={billing.step1Value}
                />
                <StatCard
                    hint={billing.step2Hint}
                    label={billing.step2Label}
                    value={billing.step2Value}
                />
                <StatCard
                    footer={
                        <>
                            {billing.step3FooterBefore}
                            <Link href={localizedPath(lang, '/checkout/success')}>
                                {billing.step3SuccessLink}
                            </Link>
                            {billing.step3FooterMid}
                            <Link href={localizedPath(lang, '/checkout/cancel')}>
                                {billing.step3CancelLink}
                            </Link>
                            {billing.step3FooterAfter}
                        </>
                    }
                    label={billing.step3Label}
                    value={billing.step3Value}
                />
            </section>
            {isLoading ? (
                <div role="status" aria-busy="true" aria-label={common.loadingPricing}>
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
            {!isLoading && levels.length > 0 && !hasLevelProducts ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={billing.levelsDescription}
                        title={billing.levelsTitle}
                    />
                    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {levels.map((level) => (
                            <li key={level.id}>
                                <StatCard
                                    hint={interpolate(format.rank, {order: level.sortOrder})}
                                    label={common.level}
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
                        title={billing.emptyProductsTitle}
                        description={billing.emptyProductsDescription}
                    />
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {products.map((product) => (
                            <Card key={product.slug} className="flex flex-col">
                                <CardHeader className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline">
                                            {product.offeringType === 'LEVEL' ? common.level : common.package}
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
                                            lang,
                                            format,
                                        )}
                                    </p>
                                    {product.description !== null && product.description !== '' ? (
                                        <p className="mt-3 leading-6">{product.description}</p>
                                    ) : null}
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        disabled={busySlug === product.slug || product.priceCents === null}
                                        onClick={() => {
                                            void handleCheckout(product.slug)
                                        }}
                                        type="button"
                                    >
                                        {busySlug === product.slug
                                            ? '…'
                                            : product.priceCents === null
                                              ? billing.ctaSoon
                                              : isAuthenticated
                                                ? billing.ctaCheckout
                                                : billing.ctaLoginChoose}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )
            ) : null}
            <p className="text-sm text-muted-foreground">
                <Link href={localizedPath(lang, '/register')}>{billing.footerRegister}</Link>
                {' · '}
                <Link href={localizedPath(lang, '/account')}>{billing.footerAccount}</Link>
                {' · '}
                <Link href={localizedPath(lang, '/downloads')}>{billing.footerDownloads}</Link>
            </p>
        </PageStack>
    )
}

export default function PricingPage(): React.JSX.Element {
    const {common} = useDictionary()
    return (
        <Suspense
            fallback={
                <PageStack className="page-container">
                    <div role="status" aria-busy="true" aria-label={common.loadingPricing}>
                        <CardGridSkeleton cards={3} columns={3} />
                    </div>
                </PageStack>
            }
        >
            <PricingContent />
        </Suspense>
    )
}
