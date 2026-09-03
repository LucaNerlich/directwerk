'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import Link from 'next/link'
import {useEffect, useId, useState, type FormEvent} from 'react'
import {useRouter} from 'next/navigation'

import {grantSubscription, listProducts, revokeSubscription} from '@/lib/api/subscriptionApi'
import {listSubscribers} from '@/lib/api/tenantSettingsApi'
import {offeringTypeLabel, subscriptionSourceLabel, subscriptionStatusLabel} from '@/lib/subscription/displayLabels'
import type {
    SubscriptionGrant,
    SubscriptionProduct,
    TenantSubscriber,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const REVOCABLE_GRANT_STATUSES = new Set(['ACTIVE', 'PAST_DUE', 'INCOMPLETE'])

function manualGrantsFromSubscribers(
    subscribers: TenantSubscriber[],
): SubscriptionGrant[] {
    const grants: SubscriptionGrant[] = []
    for (const subscriber of subscribers) {
        for (const subscription of subscriber.subscriptions) {
            if (
                subscription.source === 'MANUAL' &&
                REVOCABLE_GRANT_STATUSES.has(subscription.status)
            ) {
                grants.push({
                    id: subscription.id,
                    userId: subscriber.userId,
                    email: subscriber.email,
                    productId: subscription.productId,
                    productSlug: subscription.productSlug,
                    productTitle: subscription.productTitle,
                    status: subscription.status,
                    source: subscription.source,
                })
            }
        }
    }
    return grants.sort((left, right) => right.id - left.id)
}

export default function GrantsClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [products, setProducts] = useState<SubscriptionProduct[]>([])
    const [email, setEmail] = useState('')
    const [productId, setProductId] = useState('')
    const [grants, setGrants] = useState<SubscriptionGrant[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)
    const {viewMode, setViewMode} = useListViewMode()
    const emailHelpId = useId()
    const productHelpId = useId()

    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    useEffect(() => {
        let active = true

        Promise.all([
            listProducts(getClientTenantHost()),
            listSubscribers(getClientTenantHost()),
        ])
            .then(([productResult, subscriberResult]) => {
                if (!active) {
                    return
                }
                const activeProducts = productResult.filter((product) => product.active)
                setProducts(activeProducts)
                if (activeProducts[0]) {
                    setProductId(String(activeProducts[0].id))
                }
                setGrants(manualGrantsFromSubscribers(subscriberResult))
                setIsLoading(false)
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
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [router])

    async function handleGrant(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        setEmailError(null)

        const trimmedEmail = email.trim()
        if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254) {
            setEmailError('Bitte eine gültige E-Mail-Adresse eingeben.')
            setIsBusy(false)
            return
        }

        const parsedProductId = Number.parseInt(productId, 10)
        if (!Number.isSafeInteger(parsedProductId) || parsedProductId < 1) {
            setErrorMessage('Bitte ein Produkt wählen.')
            setIsBusy(false)
            return
        }

        try {
            const grant = await grantSubscription(getClientTenantHost(), {
                email: trimmedEmail,
                productId: parsedProductId,
            })
            setGrants((current) => [grant, ...current])
            setStatusMessage(`Freigeschaltet: ${grant.email} → ${grant.productTitle}`)
            setEmail('')
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Freischaltung fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    async function handleRevoke(subscriptionId: number): Promise<void> {
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)

        try {
            const revoked = await revokeSubscription(
                getClientTenantHost(),
                subscriptionId,
            )
            setGrants((current) =>
                current.map((grant) =>
                    grant.id === subscriptionId ? revoked : grant,
                ),
            )
            setStatusMessage(`Widerrufen: ${revoked.email}`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Widerruf fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Abos"
                    title="Freischaltungen"
                    description="Zugang manuell vergeben oder widerrufen. Aktive Freischaltungen werden aus der Abonnentenliste geladen."
                />
                <p className="text-sm text-muted-foreground" role="status">Laden…</p>
                <div className="grid gap-3" aria-hidden="true">
                    <Skeleton className="h-24 w-full max-w-xl" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </PageStack>
        )
    }

    const grantItems: EntityListViewItem[] = grants.map((grant) => ({
        id: grant.id,
        title: grant.email,
        description: `${grant.productTitle} · ${subscriptionSourceLabel(grant.source)}`,
        trailing: <Badge variant="secondary">{subscriptionStatusLabel(grant.status)}</Badge>,
        actions:
            grant.status === 'ACTIVE' ? (
                <Button
                    disabled={isBusy}
                    onClick={() => void handleRevoke(grant.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    Widerrufen
                </Button>
            ) : undefined,
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow="Abos"
                title="Freischaltungen"
                description="Zugang manuell vergeben oder widerrufen — z. B. für Gäste, Team oder Gewinnspiele. Freischaltungen erscheinen auch unter Abonnenten."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage" />} variant="outline">
                        Zu Zahlungen
                    </Button>
                }
            />

            {products.length === 0 ? (
                <EmptyState
                    title="Zuerst ein Produkt anlegen"
                    description="Ohne aktives Abo-Produkt kannst du niemanden freischalten."
                    action={
                        <Button nativeButton={false} render={<Link href="/manage/products/new" />}>
                            Produkt anlegen
                        </Button>
                    }
                />
            ) : null}

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {products.length > 0 ? (
            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Neue Freischaltung</CardTitle>
                    <CardDescription>
                        Die Person erhält sofort Zugang — ohne Zahlung. Ideal für Gäste und manuelle Ausnahmen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
            <form className="grid gap-5" onSubmit={(event) => void handleGrant(event)}>
                <div className="grid gap-2">
                    <Label htmlFor="grant-email">E-Mail</Label>
                    <Input
                        aria-describedby={emailHelpId}
                        aria-invalid={emailError !== null}
                        autoComplete="email"
                        id="grant-email"
                        maxLength={254}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        type="email"
                        value={email}
                    />
                    <p className="text-xs text-muted-foreground" id={emailHelpId}>
                        An diese Adresse wird der Zugang geknüpft. Bereits registrierte Konten werden sofort freigeschaltet.
                    </p>
                    {emailError !== null ? (
                        <p className="text-sm text-destructive" role="alert">{emailError}</p>
                    ) : null}
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="grant-product">Produkt</Label>
                    <SelectControl
                        aria-describedby={productHelpId}
                        id="grant-product"
                        onChange={(event) => setProductId(event.target.value)}
                        required
                        value={productId}
                    >
                        {products.length === 0 ? (
                            <option value="">Keine aktiven Produkte</option>
                        ) : null}
                        {products.map((product) => (
                            <option key={product.id} value={product.id}>
                                {product.title} ({offeringTypeLabel(product.offeringType)})
                            </option>
                        ))}
                    </SelectControl>
                    <p className="text-xs text-muted-foreground" id={productHelpId}>
                        Nur aktive Produkte. Stufen schließen alle niedrigeren Stufen ein; Pakete schalten nur ihre Regeln frei.
                    </p>
                </div>
                <div>
                <Button disabled={isBusy} type="submit">
                    {isBusy ? 'Arbeiten…' : 'Freischalten'}
                </Button>
                </div>
            </form>
                </CardContent>
            </Card>
            ) : null}

            {products.length > 0 ? (
            <section aria-labelledby="grants-list-heading" className="flex flex-col gap-4">
                <SectionHeader
                    id="grants-list-heading"
                    title={`Aktive Freischaltungen (${grants.length})`}
                    description="Manuell vergebene Zugänge aus der Abonnentenliste."
                />
            {grants.length > 0 ? (
                <EntityListSection
                    items={grantItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
            ) : (
                <EmptyState
                    title="Noch keine Freischaltungen"
                    description="Vergib oben die erste Freischaltung — sie erscheint sofort in dieser Liste."
                />
            )}
            </section>
            ) : null}
        </PageStack>
    )
}
