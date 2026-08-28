'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import StatCard from '@directwerk/ui/components/stat-card'

import SelectControl from '@/components/studio/SelectControl'
import {getBillingDashboard, revokeSubscription} from '@/lib/api/tenantApi'
import type {BillingDashboard, BillingMembership} from '@directwerk/api/types'
import {formatMoney} from '@/lib/format/money'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const REVOCABLE_STATUSES = new Set(['ACTIVE', 'PAST_DUE', 'INCOMPLETE'])

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
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert>
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}
            {dashboard === null && errorMessage === null ? (
                <p className="text-sm text-muted-foreground">Laden…</p>
            ) : null}

            {dashboard !== null ? (
                <>
                    <section className="rounded-xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Stripe
                        </p>
                        <p className="mt-2 font-medium">{stripeStatusLabel(dashboard.stripe.status)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{dashboard.stripe.message}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Zahlungen: {dashboard.stripe.chargesEnabled ? 'ja' : 'nein'}
                            {' · '}
                            Auszahlungen: {dashboard.stripe.payoutsEnabled ? 'ja' : 'nein'}
                        </p>
                        {dashboard.stripe.status !== 'CONNECTED' ? (
                            <p className="mt-3">
                                <Button nativeButton={false} render={<Link href="/settings/stripe" />}>
                                    Stripe verbinden
                                </Button>
                            </p>
                        ) : null}
                    </section>

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
                                hint="Stripe vs. Freischaltung"
                                label="Bezahlt / Freischaltung"
                                value={`${dashboard.stats.activePaidSubscriptions} / ${dashboard.stats.activeGrantSubscriptions}`}
                            />
                        </li>
                        <li>
                            <StatCard
                                label="Geschätzter Monatswert"
                                value={formatMoney(
                                    dashboard.stats.estimatedMonthlyCents,
                                    dashboard.stats.currency,
                                )}
                            />
                        </li>
                        <li>
                            <StatCard
                                label="Zahlungsrückstand"
                                value={dashboard.stats.pastDueSubscriptions}
                            />
                        </li>
                        <li>
                            <StatCard
                                hint="neu / gekündigt"
                                label="Diesen Monat"
                                value={`+${dashboard.stats.newThisMonth} / −${dashboard.stats.canceledThisMonth}`}
                            />
                        </li>
                    </ul>

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
                        <section className="flex flex-col gap-4">
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
                                . Widerruf eines Stripe-Abos kündigt es auch bei Stripe.
                            </p>
                            {visibleMemberships.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Keine Mitgliedschaften für diesen Filter.</p>
                            ) : (
                                <ListPanel>
                                    {visibleMemberships.map((row) => (
                                        <ListPanelRow key={row.id}>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-medium">{row.email}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {row.productTitle}
                                                    {' · '}
                                                    {statusLabel(row.status)}
                                                    {' · '}
                                                    {sourceLabel(row.source)}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {row.startedAt !== null
                                                        ? `ab ${formatDate(row.startedAt)} · ${
                                                              row.endsAt !== null
                                                                  ? `bis ${formatDate(row.endsAt)}`
                                                                  : 'unbefristet'
                                                          }`
                                                        : row.endsAt !== null
                                                          ? `bis ${formatDate(row.endsAt)}`
                                                          : 'unbefristet'}
                                                </p>
                                            </div>
                                            {canRevoke(row) ? (
                                                <div className="flex shrink-0 flex-wrap gap-2">
                                                    <Button
                                                        disabled={isBusy}
                                                        onClick={() => {
                                                            void handleRevoke(row)
                                                        }}
                                                        type="button"
                                                        variant={pendingRevokeId === row.id ? 'destructive' : 'outline'}
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
                                            ) : null}
                                        </ListPanelRow>
                                    ))}
                                </ListPanel>
                            )}
                        </section>
                    )}
                </>
            ) : null}
        </PageStack>
    )
}
