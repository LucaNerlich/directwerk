'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import StatCard from '@directwerk/ui/components/stat-card'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import SelectControl from '@/components/studio/SelectControl'
import {getBillingDashboard, revokeSubscription} from '@/lib/api/subscriptionApi'
import {
    subscriptionSourceLabel,
    subscriptionStatusLabel,
} from '@/lib/subscription/displayLabels'
import type {BillingDashboard, BillingMembership} from '@directwerk/api/types'
import {formatMoney} from '@directwerk/api/format'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const REVOCABLE_STATUSES = new Set(['ACTIVE', 'PAST_DUE', 'INCOMPLETE'])

function stripeStatusLabel(status: string): string {
    switch (status) {
        case 'CONNECTED':
            return 'Verbunden'
        case 'RESTRICTED':
            return 'Eingeschränkt'
        case 'PENDING':
            return 'Einrichtung offen'
        case 'NOT_CONNECTED':
            return 'Nicht verbunden'
        default:
            return status
    }
}

function stripeStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'CONNECTED':
            return 'default'
        case 'RESTRICTED':
        case 'PENDING':
            return 'secondary'
        default:
            return 'outline'
    }
}

function formatDate(value: string | null): string {
    if (value === null) {
        return 'unbefristet'
    }
    return value.slice(0, 10)
}

function canRevoke(row: BillingMembership): boolean {
    return REVOCABLE_STATUSES.has(row.status)
}

export default function PaymentsDashboardClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [dashboard, setDashboard] = useState<BillingDashboard | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isBusy, setIsBusy] = useState(false)
    const [pendingRevokeId, setPendingRevokeId] = useState<number | null>(null)
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sourceFilter, setSourceFilter] = useState('all')
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        let active = true
        getBillingDashboard(getClientTenantHost())
            .then((result) => {
                if (active) {
                    setDashboard(result)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Zahlungsübersicht konnte nicht geladen werden.',
                )
            })
        return () => {
            active = false
        }
    }, [router])

    const visibleMemberships = useMemo(() => {
        if (dashboard === null) {
            return []
        }
        const needle = query.trim().toLowerCase()
        return dashboard.memberships.filter((row) => {
            if (statusFilter !== 'all' && row.status !== statusFilter) {
                return false
            }
            if (sourceFilter !== 'all' && row.source !== sourceFilter) {
                return false
            }
            if (needle.length === 0) {
                return true
            }
            return (
                row.email.toLowerCase().includes(needle) ||
                row.productTitle.toLowerCase().includes(needle)
            )
        })
    }, [dashboard, query, sourceFilter, statusFilter])

    async function reloadDashboard(): Promise<BillingDashboard> {
        const result = await getBillingDashboard(getClientTenantHost())
        setDashboard(result)
        return result
    }

    async function handleRetry(): Promise<void> {
        setErrorMessage(null)
        try {
            await reloadDashboard()
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Zahlungsübersicht konnte nicht geladen werden.',
            )
        }
    }

    const hasActiveFilters = query.trim().length > 0 || statusFilter !== 'all' || sourceFilter !== 'all'

    function resetFilters(): void {
        setQuery('')
        setStatusFilter('all')
        setSourceFilter('all')
    }

    async function handleRevoke(row: BillingMembership): Promise<void> {
        if (pendingRevokeId !== row.id) {
            setPendingRevokeId(row.id)
            setStatusMessage(
                row.source === 'STRIPE'
                    ? 'Nochmal bestätigen: das Stripe-Abo wird gekündigt und der Zugang entfällt sofort.'
                    : 'Nochmal bestätigen: der Zugang entfällt sofort.',
            )
            return
        }

        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const revoked = await revokeSubscription(getClientTenantHost(), row.id)
            setPendingRevokeId(null)
            await reloadDashboard()
            setStatusMessage(`Zugang beendet: ${revoked.email}`)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Widerruf fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    return (
        <PageStack>
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<Link href="/settings/stripe" />} size="lg">
                        Stripe
                    </Button>
                }
                description="Übersicht über aktive Mitglieder, Zahlungsrückstände und geschätzte Einnahmen. Hier kannst du Zugänge beenden."
                eyebrow="Abos"
                title="Zahlungen & Mitgliedschaften"
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button onClick={() => void handleRetry()} size="sm" type="button" variant="outline">
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
            {dashboard === null && errorMessage === null ? (
                <div className="flex flex-col gap-4" aria-busy="true">
                    <p className="text-sm text-muted-foreground" role="status">Laden…</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                        {[0, 1, 2].map((index) => (
                            <Skeleton className="h-28 w-full" key={index} />
                        ))}
                    </div>
                </div>
            ) : null}

            {dashboard !== null ? (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                <span className="flex flex-wrap items-center gap-2">
                                    Stripe
                                    <Badge variant={stripeStatusVariant(dashboard.stripe.status)}>
                                        {stripeStatusLabel(dashboard.stripe.status)}
                                    </Badge>
                                </span>
                            </CardTitle>
                            <CardDescription>{dashboard.stripe.message}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">
                            Zahlungen möglich: {dashboard.stripe.chargesEnabled ? 'Ja' : 'Nein'}
                            {' · '}
                            Auszahlungen möglich: {dashboard.stripe.payoutsEnabled ? 'Ja' : 'Nein'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Erst wenn Stripe verbunden ist und Zahlungen möglich sind, können Hörerinnen und Hörer per Checkout kaufen.
                        </p>
                        {dashboard.stripe.status !== 'CONNECTED' ? (
                            <p>
                                <Button nativeButton={false} render={<Link href="/settings/stripe" />}>
                                    Stripe verbinden
                                </Button>
                            </p>
                        ) : null}
                        </CardContent>
                    </Card>

                    <section aria-labelledby="billing-stats-heading" className="flex flex-col gap-4">
                        <SectionHeader
                            id="billing-stats-heading"
                            title="Kennzahlen"
                            description="Aktive Zugänge, Zahlungsrückstände und geschätzter Monatswert aus allen aktiven Preisen."
                        />
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <li>
                            <StatCard
                                hint="Aktive Abonnements"
                                label="Mitgliedschaften"
                                value={dashboard.stats.activeSubscriptions}
                            />
                        </li>
                        <li>
                            <StatCard
                                hint="Eindeutige Konten mit Zugang"
                                label="Aktive Mitglieder"
                                value={dashboard.stats.uniqueActiveMembers}
                            />
                        </li>
                        <li>
                            <StatCard
                                hint="Stripe-Käufe vs. manuelle Freischaltungen"
                                label="Bezahlt / Freischaltung"
                                value={`${dashboard.stats.activePaidSubscriptions} / ${dashboard.stats.activeGrantSubscriptions}`}
                            />
                        </li>
                        <li>
                            <StatCard
                                hint="Summe aller aktiven Preise, auf den Monat gerechnet"
                                label="Geschätzter Monatswert"
                                value={formatMoney(
                                    dashboard.stats.estimatedMonthlyCents,
                                    dashboard.stats.currency,
                                )}
                            />
                        </li>
                        <li>
                            <StatCard
                                hint="Benötigen deine Aufmerksamkeit — Zahlung fehlgeschlagen"
                                label="Zahlungsrückstand"
                                value={dashboard.stats.pastDueSubscriptions}
                            />
                        </li>
                        <li>
                            <StatCard
                                hint="Neue Zugänge vs. beendete Zugänge"
                                label="Diesen Monat"
                                value={`+${dashboard.stats.newThisMonth} / −${dashboard.stats.canceledThisMonth}`}
                            />
                        </li>
                    </ul>
                    </section>

                    <div className="flex flex-wrap gap-2">
                        <Button nativeButton={false} render={<Link href="/manage/products" />} variant="outline">
                            Produkte
                        </Button>
                        <Button nativeButton={false} render={<Link href="/manage/grants" />} variant="outline">
                            Freischaltungen
                        </Button>
                        <Button nativeButton={false} render={<Link href="/manage/subscribers" />} variant="outline">
                            Abonnenten
                        </Button>
                    </div>

                    {dashboard.memberships.length === 0 ? (
                        <EmptyState
                            title="Noch keine Mitgliedschaften"
                            description="Lege ein Produkt mit Preis an, verbinde Stripe oder vergebe eine Freischaltung."
                            action={
                                <Button nativeButton={false} render={<Link href="/manage/products/new" />}>
                                    Produkt anlegen
                                </Button>
                            }
                        />
                    ) : (
                        <section aria-labelledby="memberships-heading" className="flex flex-col gap-4">
                            <SectionHeader
                                id="memberships-heading"
                                title={`Mitgliedschaften (${dashboard.memberships.length})`}
                                description="Suche nach E-Mail oder Produkt. Der Widerruf eines Stripe-Abos kündigt es auch bei Stripe."
                                action={
                                    hasActiveFilters ? (
                                        <Button onClick={resetFilters} size="sm" type="button" variant="ghost">
                                            Filter zurücksetzen
                                        </Button>
                                    ) : undefined
                                }
                            />
                            <div className="grid gap-3 md:grid-cols-3">
                                <label className="grid gap-2 text-sm font-medium" htmlFor="membership-search">
                                    Suchen
                                    <Input
                                        id="membership-search"
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="E-Mail oder Produkt"
                                        type="search"
                                        value={query}
                                    />
                                </label>
                                <label className="grid gap-2 text-sm font-medium" htmlFor="membership-status">
                                    Status
                                    <SelectControl
                                        id="membership-status"
                                        onChange={(event) => setStatusFilter(event.target.value)}
                                        value={statusFilter}
                                    >
                                        <option value="all">Alle</option>
                                        <option value="ACTIVE">Aktiv</option>
                                        <option value="PAST_DUE">Zahlungsrückstand</option>
                                        <option value="INCOMPLETE">Unvollständig</option>
                                        <option value="CANCELED">Gekündigt</option>
                                        <option value="EXPIRED">Abgelaufen</option>
                                    </SelectControl>
                                </label>
                                <label className="grid gap-2 text-sm font-medium" htmlFor="membership-source">
                                    Quelle
                                    <SelectControl
                                        id="membership-source"
                                        onChange={(event) => setSourceFilter(event.target.value)}
                                        value={sourceFilter}
                                    >
                                        <option value="all">Alle</option>
                                        <option value="STRIPE">Stripe</option>
                                        <option value="MANUAL">Freischaltung</option>
                                    </SelectControl>
                                </label>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {visibleMemberships.length} von {dashboard.memberships.length} angezeigt
                                {dashboard.stats.totalMemberships > dashboard.memberships.length
                                    ? ` · ${dashboard.stats.totalMemberships} insgesamt`
                                    : ''}
                            </p>
                            {visibleMemberships.length === 0 ? (
                                <EmptyState
                                    title="Keine Mitgliedschaften für diesen Filter"
                                    description="Passe Suche, Status oder Quelle an, um weitere Einträge zu sehen."
                                    action={
                                        <Button onClick={resetFilters} type="button" variant="outline">
                                            Filter zurücksetzen
                                        </Button>
                                    }
                                />
                            ) : (
                                <EntityListSection
                                    items={visibleMemberships.map((row) => ({
                                        id: row.id,
                                        title: row.email,
                                        description: `${row.productTitle} · ${subscriptionStatusLabel(row.status)} · ${subscriptionSourceLabel(row.source)}`,
                                        descriptions: [
                                            row.startedAt !== null
                                                ? `ab ${formatDate(row.startedAt)} · ${
                                                      row.endsAt !== null
                                                          ? `bis ${formatDate(row.endsAt)}`
                                                          : 'unbefristet'
                                                  }`
                                                : row.endsAt !== null
                                                  ? `bis ${formatDate(row.endsAt)}`
                                                  : 'unbefristet',
                                        ],
                                        actions: canRevoke(row) ? (
                                            <div className="flex shrink-0 flex-wrap gap-2">
                                                <Button
                                                    disabled={isBusy}
                                                    onClick={() => {
                                                        void handleRevoke(row)
                                                    }}
                                                    type="button"
                                                    variant={
                                                        pendingRevokeId === row.id
                                                            ? 'destructive'
                                                            : 'outline'
                                                    }
                                                >
                                                    {pendingRevokeId === row.id
                                                        ? 'Wirklich beenden'
                                                        : 'Zugang beenden'}
                                                </Button>
                                                {pendingRevokeId === row.id ? (
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
                                        ) : undefined,
                                    }))}
                                    onViewModeChange={setViewMode}
                                    showSelection={false}
                                    viewMode={viewMode}
                                />
                            )}
                        </section>
                    )}
                </>
            ) : null}
        </PageStack>
    )
}
