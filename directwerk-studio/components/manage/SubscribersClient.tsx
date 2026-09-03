'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
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

import {revokeSubscription} from '@/lib/api/subscriptionApi'
import {listSubscribers} from '@/lib/api/tenantSettingsApi'
import {
    subscriptionSourceLabel,
    subscriptionStatusLabel,
} from '@/lib/subscription/displayLabels'
import type {TenantSubscriber, TenantSubscriberSubscription} from '@directwerk/api/types'
import {useCachedTenantQuery} from '@directwerk/api/client/useCachedTenantQuery'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {getClientTenantHost} from '@directwerk/api/tenant'

const REVOCABLE = new Set(['ACTIVE', 'PAST_DUE', 'INCOMPLETE'])

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
    const [query, setQuery] = useState('')
    const {viewMode, setViewMode} = useListViewMode()

    const subscribers = useMemo(() => {
        const loaded = loadedSubscribers ?? []
        const needle = query.trim().toLowerCase()
        if (needle.length === 0) {
            return loaded
        }
        return loaded.filter((subscriber) => {
            if (subscriber.email.toLowerCase().includes(needle)) {
                return true
            }
            if (subscriber.name !== null && subscriber.name.toLowerCase().includes(needle)) {
                return true
            }
            return subscriber.subscriptions.some((item) =>
                item.productTitle.toLowerCase().includes(needle),
            )
        })
    }, [loadedSubscribers, query])
    const totalSubscribers = loadedSubscribers?.length ?? 0
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
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Abos"
                    title="Abonnenten"
                    description="Wer Zugang zu deinen bezahlten Inhalten hat — über Kauf oder Freischaltung."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <div className="grid gap-3" aria-hidden="true">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </PageStack>
        )
    }

    const subscriberItems: EntityListViewItem[] = subscribers.map((subscriber) => ({
        id: subscriber.userId,
        title: subscriber.email,
        description: `${subscriber.name !== null ? `${subscriber.name} · ` : ''}Konto: ${subscriptionStatusLabel(subscriber.status)}`,
        trailing: (
            <Badge variant={subscriber.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                {subscriptionStatusLabel(subscriber.status)}
            </Badge>
        ),
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
                                    {subscriptionStatusLabel(item.status)}
                                    {' · '}
                                    {subscriptionSourceLabel(item.source)}
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
        <PageStack>
            <PageHeader
                eyebrow="Abos"
                title="Abonnenten"
                description="Wer Zugang zu deinen bezahlten Inhalten hat — über Kauf oder Freischaltung. Gekaufte und manuell vergebene Zugänge stehen nebeneinander."
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button onClick={reload} size="sm" type="button" variant="outline">
                            Wiederholen
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {errorMessage === null && totalSubscribers === 0 ? (
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

            {totalSubscribers > 0 ? (
                <section aria-labelledby="subscribers-heading" className="flex flex-col gap-4">
                    <SectionHeader
                        id="subscribers-heading"
                        title={`Abonnenten (${totalSubscribers})`}
                        description="Pro Person stehen alle Produkte mit Status, Quelle und Laufzeit."
                    />
                    <div className="grid w-full max-w-xl gap-2">
                        <Label htmlFor="subscriber-search">Suchen</Label>
                        <Input
                            id="subscriber-search"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="E-Mail, Name oder Produkt"
                            type="search"
                            value={query}
                        />
                    </div>
                    {subscribers.length === 0 ? (
                        <EmptyState
                            title="Keine Abonnenten für diese Suche"
                            description="Passe den Suchbegriff an, um weitere Einträge zu sehen."
                            action={
                                <Button onClick={() => setQuery('')} type="button" variant="outline">
                                    Suche zurücksetzen
                                </Button>
                            }
                        />
                    ) : (
                <EntityListSection
                    items={subscriberItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
                    )}
                </section>
            ) : null}
        </PageStack>
    )
}
