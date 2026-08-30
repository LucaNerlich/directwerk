'use client'

import Link from 'next/link'
import {useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {revokeSubscription} from '@/lib/api/subscriptionApi'
import {listSubscribers} from '@/lib/api/tenantSettingsApi'
import type {TenantSubscriber, TenantSubscriberSubscription} from '@directwerk/api/types'
import {useCachedTenantQuery} from '@directwerk/api/client/useCachedTenantQuery'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {getClientTenantHost} from '@directwerk/api/tenant'

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
    const authRedirect = useAuthRequired()
    const tenantHost = getClientTenantHost()
    const {
        data: loadedSubscribers,
        error: loadError,
        isLoading,
        reload,
    } = useCachedTenantQuery(
        (host) => listSubscribers(host),
        {
            namespace: 'tenant-subscribers',
            tenantHost,
            fallbackError: 'Abonnenten konnten nicht geladen werden.',
        },
    )
    const [actionError, setActionError] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [pendingRevokeId, setPendingRevokeId] = useState<number | null>(null)
    const {viewMode, setViewMode} = useListViewMode()

    const subscribers = loadedSubscribers ?? []
    const errorMessage = actionError ?? loadError

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
        setActionError(null)
        setStatusMessage(null)
        try {
            await revokeSubscription(getClientTenantHost(), item.id)
            setPendingRevokeId(null)
            setStatusMessage(`Zugang beendet: ${email}`)
            reload()
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setActionError(
                error instanceof Error ? error.message : 'Widerruf fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    if (isLoading) {
        return <p>Wird geladen…</p>
    }

    const subscriberItems: EntityListViewItem[] = subscribers.map((subscriber) => ({
        id: subscriber.userId,
        title: subscriber.email,
        description: `${subscriber.name !== null ? `${subscriber.name} · ` : ''}Konto: ${subscriber.status}`,
        extra:
            subscriber.subscriptions.length === 0 ? (
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
            ),
    }))

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
                <EntityListSection
                    items={subscriberItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
            ) : null}
        </div>
    )
}
