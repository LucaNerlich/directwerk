'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import EntitlementDebuggerDialog from '@/components/manage/EntitlementDebuggerDialog'
import {t} from '@/lib/i18n/dictionary'
import {useCallback, useEffect, useState} from 'react'

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
import {listAllSubscribers, listSubscribers} from '@/lib/api/tenantSettingsApi'
import {
    buildSubscriberCsv,
    downloadSubscriberCsv,
} from '@/lib/manage/subscriberCsv'
import {
    subscriptionSourceLabel,
    subscriptionStatusLabel,
} from '@/lib/subscription/displayLabels'
import type {TenantSubscriber, TenantSubscriberSubscription} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useTwoStepConfirm} from '@/lib/hooks/useTwoStepConfirm'

const REVOCABLE = new Set(['ACTIVE', 'PAST_DUE', 'INCOMPLETE'])
const PAGE_SIZE = 50

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
    const dict = useDictionary()
    const m = dict.manage
    const authRedirect = useAuthRequired()
    const [subscribers, setSubscribers] = useState<TenantSubscriber[]>([])
    const [totalSubscribers, setTotalSubscribers] = useState(0)
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(PAGE_SIZE)
    const [searchInput, setSearchInput] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [reloadToken, setReloadToken] = useState(0)
    const {pending: pendingRevokeId, arm: armRevoke, reset: resetRevoke} = useTwoStepConfirm<number>()
    const {viewMode, setViewMode} = useListViewMode()
    const [debugSubscriber, setDebugSubscriber] = useState<TenantSubscriber | null>(null)

    useEffect(() => {
        const handle = window.setTimeout(() => {
            setSearchQuery(searchInput.trim())
            setPage(0)
        }, 300)
        return () => window.clearTimeout(handle)
    }, [searchInput])

    const reload = useCallback(async (): Promise<void> => {
        const result = await listSubscribers({
            page,
            size: PAGE_SIZE,
            ...(searchQuery.length > 0 ? {q: searchQuery} : {}),
        })
        setSubscribers(result.content)
        setTotalSubscribers(result.totalElements)
        setPageSize(result.size)
    }, [page, searchQuery])

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setLoadError(null)
        reload()
            .then(() => {
                if (!active) {
                    return
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error ? error.message : dict.write.subscribersLoadFailed,
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [reload, reloadToken, authRedirect, dict.write.subscribersLoadFailed])

    const errorMessage = actionError ?? loadError
    const hasPreviousPage = page > 0
    const hasNextPage = (page + 1) * pageSize < totalSubscribers

    async function handleRevoke(item: TenantSubscriberSubscription, email: string): Promise<void> {
        if (!armRevoke(item.id)) {
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
            await revokeSubscription( item.id)
            resetRevoke()
            setStatusMessage(`Zugang beendet: ${email}`)
            setReloadToken((value) => value + 1)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setActionError(
                error instanceof Error ? error.message : 'Widerruf fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
            resetRevoke()
        }
    }

    async function handleCsvExport(): Promise<void> {
        setIsBusy(true)
        setActionError(null)
        try {
            const rows = await listAllSubscribers(
                searchQuery.length > 0 ? {q: searchQuery} : undefined,
            )
            const csv = buildSubscriberCsv(rows)
            const stamp = new Date().toISOString().slice(0, 10)
            downloadSubscriberCsv(csv, `abonnenten-${stamp}.csv`)
            setStatusMessage(m.csvExportHeruntergeladen)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setActionError(
                error instanceof Error ? error.message : dict.write.subscribersLoadFailed,
            )
        } finally {
            setIsBusy(false)
        }
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={m.subscriptionsEyebrow}
                    title={m.subscribersTitle}
                    description={m.werZugangDeinenBezahltenInhaltenKauf}
                />
                <p className="text-sm text-muted-foreground" role="status">{dict.common.loading}</p>
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
        actions: (
            <Button
                onClick={() => {
                    setDebugSubscriber(subscriber)
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                {m.entitlementCheckCta}
            </Button>
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
                                                resetRevoke()
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
                eyebrow={m.subscriptionsEyebrow}
                title={m.subscribersTitle}
                description={m.zugangBezahltenInhaltenKaufFreischaltungGekaufte}
                actions={
                    totalSubscribers > 0 || searchQuery.length > 0 ? (
                        <Button
                            disabled={isBusy || totalSubscribers === 0}
                            onClick={() => {
                                void handleCsvExport()
                            }}
                            type="button"
                            variant="outline"
                        >
                            {m.csvExport}
                        </Button>
                    ) : undefined
                }
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button
                            onClick={() => setReloadToken((value) => value + 1)}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {dict.common.retryShort}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {loadError === null && totalSubscribers === 0 && searchQuery.length === 0 ? (
                <EmptyState
                    title={m.keineAbonnenten}
                    description={m.legeZuerstProduktVergebeFreischaltungWarte}
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button nativeButton={false} render={<LocaleLink href="/manage/products" />}>
                                {m.toProducts}
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href="/manage/grants" />}
                                variant="outline"
                            >
                                {m.grantAccessCta}
                            </Button>
                        </div>
                    }
                />
            ) : null}

            {loadError === null && (totalSubscribers > 0 || searchQuery.length > 0) ? (
                <section aria-labelledby="subscribers-heading" className="flex flex-col gap-4">
                    <SectionHeader
                        id="subscribers-heading"
                        title={t(m.abonnenten, {totalSubscribers})}
                        description={m.proPersonStehenAlleProdukteStatus}
                    />
                    <div className="grid w-full max-w-xl gap-2">
                        <Label htmlFor="subscriber-search">{m.searchLabel}</Label>
                        <Input
                            id="subscriber-search"
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder={m.emailNameOrProduct}
                            type="search"
                            value={searchInput}
                        />
                    </div>
                    {subscribers.length === 0 ? (
                        <EmptyState
                            title={m.keineAbonnentenSuche}
                            description={m.passeSuchbegriffWeitereEintraegeSehen}
                            action={
                                <Button onClick={() => setSearchInput('')} type="button" variant="outline">
                                    {dict.podcast.resetSearch}
                                </Button>
                            }
                        />
                    ) : (
                        <>
                <EntityListSection
                    items={subscriberItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
                <p aria-live="polite" className="text-sm text-muted-foreground">
                    {t(m.pageSummary, {
                        page: page + 1,
                        pageSize,
                        totalSubscribers,
                    })}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        disabled={!hasPreviousPage}
                        onClick={() => setPage((current) => Math.max(0, current - 1))}
                        type="button"
                        variant="outline"
                    >
                        {m.previousPage}
                    </Button>
                    <Button
                        disabled={!hasNextPage}
                        onClick={() => setPage((current) => current + 1)}
                        type="button"
                        variant="outline"
                    >
                        {m.nextPage}
                    </Button>
                </div>
                        </>
                    )}
                </section>
            ) : null}

            <EntitlementDebuggerDialog
                onOpenChange={(next) => {
                    if (!next) {
                        setDebugSubscriber(null)
                    }
                }}
                open={debugSubscriber !== null}
                subscriber={debugSubscriber}
            />
        </PageStack>
    )
}
