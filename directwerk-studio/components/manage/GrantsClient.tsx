'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import Link from 'next/link'
import {useEffect, useState, type FormEvent} from 'react'
import {useRouter} from 'next/navigation'

import {
    grantSubscription,
    listProducts,
    listSubscribers,
    revokeSubscription,
} from '@/lib/api/tenantApi'
import type {
    SubscriptionGrant,
    SubscriptionProduct,
    TenantSubscriber,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
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

        const parsedProductId = Number.parseInt(productId, 10)
        if (!Number.isSafeInteger(parsedProductId) || parsedProductId < 1) {
            setErrorMessage('Bitte ein Produkt wählen.')
            setIsBusy(false)
            return
        }

        try {
            const grant = await grantSubscription(getClientTenantHost(), {
                email: email.trim(),
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
        return <p>Laden…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Abos"
                title="Freischaltungen"
                description="Zugang manuell vergeben oder widerrufen. Aktive Freischaltungen werden aus der Abonnentenliste geladen."
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

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {statusMessage ? <p role="status">{statusMessage}</p> : null}

            {products.length > 0 ? (
            <form onSubmit={(event) => void handleGrant(event)}>
                <p>
                    <label htmlFor="grant-email">E-Mail</label>
                    <br />
                    <Input
                        autoComplete="email"
                        id="grant-email"
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        type="email"
                        value={email}
                    />
                </p>
                <p>
                    <label htmlFor="grant-product">Produkt</label>
                    <br />
                    <SelectControl
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
                                {product.title} ({product.offeringType})
                            </option>
                        ))}
                    </SelectControl>
                </p>
                <Button disabled={isBusy} type="submit">
                    {isBusy ? 'Arbeiten…' : 'Freischalten'}
                </Button>
            </form>
            ) : null}

            {grants.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">E-Mail</TableHead>
                            <TableHead scope="col">Produkt</TableHead>
                            <TableHead scope="col">Status</TableHead>
                            <TableHead scope="col">Aktion</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {grants.map((grant) => (
                            <TableRow key={grant.id}>
                                <TableCell>{grant.email}</TableCell>
                                <TableCell>{grant.productTitle}</TableCell>
                                <TableCell>{grant.status}</TableCell>
                                <TableCell>
                                    {grant.status === 'ACTIVE' ? (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() =>
                                                void handleRevoke(grant.id)
                                            }
                                            type="button"
                                        >
                                            Widerrufen
                                        </Button>
                                    ) : (
                                        '—'
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : null}
        </div>
    )
}
