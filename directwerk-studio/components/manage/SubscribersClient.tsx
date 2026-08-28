'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'

import {listSubscribers, revokeSubscription} from '@/lib/api/tenantApi'
import type {TenantSubscriber, TenantSubscriberSubscription} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const REVOCABLE = new Set(['ACTIVE', 'PAST_DUE', 'INCOMPLETE'])

function sourceLabel(source: string): string {
    if (source === 'STRIPE') {
        return 'Stripe'
    }
    if (source === 'MANUAL' || source === 'SEED') {
        return 'Freischaltung'
    }
    return source
}

function statusLabel(status: string): string {
    switch (status) {
        case 'ACTIVE':
            return 'Aktiv'
        case 'PAST_DUE':
            return 'Zahlungsrückstand'
        case 'INCOMPLETE':
            return 'Unvollständig'
        case 'CANCELED':
            return 'Gekündigt'
        case 'EXPIRED':
            return 'Abgelaufen'
        default:
            return status
    }
}

function periodLabel(item: TenantSubscriberSubscription): string {
    if (item.endsAt !== null) {
        return `bis ${item.endsAt.slice(0, 10)}`
    }
    if (item.startedAt !== null) {
        return `ab ${item.startedAt.slice(0, 10)} · unbefristet`
    }
    return 'unbefristet'
}

export default function SubscribersClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [subscribers, setSubscribers] = useState<TenantSubscriber[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)
    const [pendingRevokeId, setPendingRevokeId] = useState<number | null>(null)

    useEffect(() => {
        let active = true

        listSubscribers(getClientTenantHost())
            .then((result) => {
                if (!active) {
                    return
                }
                setSubscribers(result)
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
                        : 'Abonnenten konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [router])

    async function handleRevoke(item: TenantSubscriberSubscription, email: string): Promise<void> {
        if (pendingRevokeId !== item.id) {
            setPendingRevokeId(item.id)
            setStatusMessage(
                item.source === 'STRIPE'
                    ? 'Nochmal bestätigen: das Stripe-Abo wird gekündigt.'
                    : 'Nochmal bestätigen: der Zugang entfällt sofort.',
            )
            return
        }
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const revoked = await revokeSubscription(getClientTenantHost(), item.id)
            setPendingRevokeId(null)
            setSubscribers((current) =>
                current.map((subscriber) => ({
                    ...subscriber,
                    subscriptions: subscriber.subscriptions.map((row) =>
                        row.id === item.id
                            ? {
                                  ...row,
                                  status: revoked.status,
                              }
                            : row,
                    ),
                })),
            )
            setStatusMessage(`Zugang beendet: ${email}`)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Widerruf fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    if (isLoading) {
        return <p>Wird geladen…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Abos"
                title="Abonnenten"
                description="Wer Zugang zu deinen bezahlten Inhalten hat — über Kauf oder Freischaltung."
            />

            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
            {statusMessage !== null ? <p role="status">{statusMessage}</p> : null}

            {errorMessage === null && subscribers.length === 0 ? (
                <EmptyState
                    title="Noch keine Abonnenten"
                    description="Lege zuerst ein Produkt an und vergebe eine Freischaltung — oder warte auf den ersten Kauf."
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button nativeButton={false} render={<Link href="/manage/products" />}>
                                Zu den Produkten
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<Link href="/manage/grants" />}
                                variant="outline"
                            >
                                Freischaltung vergeben
                            </Button>
                        </div>
                    }
                />
            ) : null}

            {subscribers.length > 0 ? (
                <ListPanel>
                    {subscribers.map((subscriber) => (
                        <ListPanelRow key={subscriber.userId}>
                            <div>
                                <p className="font-medium">{subscriber.email}</p>
                                <p className="text-sm text-muted-foreground">
                                    {subscriber.name !== null ? `${subscriber.name} · ` : ''}
                                    Konto: {subscriber.status}
                                </p>
                            </div>
                            {subscriber.subscriptions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Keine Produkte</p>
                            ) : (
                                <ul className="flex flex-col gap-3">
                                    {subscriber.subscriptions.map((item) => (
                                        <li
                                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                            key={item.id}
                                        >
                                            <div>
                                                <p>{item.productTitle}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {statusLabel(item.status)}
                                                    {' · '}
                                                    {sourceLabel(item.source)}
                                                    {' · '}
                                                    {periodLabel(item)}
                                                    {item.externalSubscriptionId !== null
                                                        ? ` · ${item.externalSubscriptionId}`
                                                        : ''}
                                                </p>
                                            </div>
                                            {REVOCABLE.has(item.status) ? (
                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <Button
                                                        disabled={isBusy}
                                                        onClick={() => {
                                                            void handleRevoke(item, subscriber.email)
                                                        }}
                                                        type="button"
                                                        variant={
                                                            pendingRevokeId === item.id
                                                                ? 'destructive'
                                                                : 'outline'
                                                        }
                                                    >
                                                        {pendingRevokeId === item.id
                                                            ? 'Wirklich beenden'
                                                            : 'Zugang beenden'}
                                                    </Button>
                                                    {pendingRevokeId === item.id ? (
                                                        <Button
                                                            disabled={isBusy}
                                                            onClick={() => {
                                                                setPendingRevokeId(null)
                                                                setStatusMessage(null)
                                                            }}
                                                            type="button"
                                                            variant="ghost"
                                                        >
                                                            Abbrechen
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </ListPanelRow>
                    ))}
                </ListPanel>
            ) : null}
        </div>
    )
}
