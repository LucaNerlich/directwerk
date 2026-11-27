'use client'

import {useEffect, useState} from 'react'

import {formatMoney} from '@directwerk/api/format'
import {apiErrorStatus} from '@directwerk/api/envelope'
import type {
    ArticleSummary,
    EpisodeSummary,
    SeriesSummary,
    SiteAnalytics,
    StudioDesk,
} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import StatCard from '@directwerk/ui/components/stat-card'

import {listAllArticles} from '@/lib/api/listAllArticles'
import {listAllEpisodes} from '@/lib/api/listAllEpisodes'
import {listSeries} from '@/lib/api/podcastApi'
import {getBillingDashboard} from '@/lib/api/subscriptionApi'
import type {BillingDashboard} from '@directwerk/api/types'
import {
    UMAMI_RANGES,
    deltaPercent,
    getUmamiStats,
    type UmamiRange,
    type UmamiStats,
} from '@/lib/api/umamiApi'
import {useDictionary} from '@/components/i18n/LocaleProvider'

interface AnalyticsDashboardProps {
    desks: StudioDesk[]
    subscriptionEnabled: boolean
    analyticsModuleEnabled: boolean
    analytics: SiteAnalytics | null
}

function countByStatus(
    items: {status: string}[],
    status: string,
): number {
    return items.filter((item) => item.status === status).length
}

function recentPublished(
    items: {publishedAt: string | null}[],
): {publishedAt: string | null}[] {
    return [...items]
        .filter((item) => item.publishedAt !== null)
        .sort((left, right) =>
            (right.publishedAt ?? '').localeCompare(left.publishedAt ?? ''),
        )
        .slice(0, 5)
}

function UmamiOpenButton({umamiHostUrl, websiteId}: {umamiHostUrl: string; websiteId: string}): React.JSX.Element {
    return (
        <Button nativeButton={false} render={<a href={`${umamiHostUrl}/websites/${websiteId}`} rel="noreferrer" target="_blank" />} variant="outline">
            In Umami öffnen
        </Button>
    )
}

function formatDate(value: string | null): string {
    if (value === null) {
        return '—'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

function rangeHint(range: UmamiRange): string {
    switch (range) {
        case '7d':
            return 'letzte 7 Tage'
        case '12m':
            return 'letzte 12 Monate'
        default:
            return 'letzte 30 Tage'
    }
}

function deltaHint(delta: number | null, range: UmamiRange): string {
    if (delta === null) {
        return rangeHint(range)
    }
    return `${delta >= 0 ? '+' : ''}${delta} % ggü. Vorperiode`
}

function UmamiLiveStats({
    stats,
    umamiHostUrl,
    websiteId,
}: {
    stats: UmamiStats
    umamiHostUrl: string
    websiteId: string
}): React.JSX.Element {
    const comparison = stats.stats.comparison
    const recent = stats.pageviews.slice(-14)
    const max = Math.max(1, ...recent.map((point) => point.y))
    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                    label="Besucher"
                    value={stats.stats.visitors}
                    hint={deltaHint(
                        comparison === null
                            ? null
                            : deltaPercent(stats.stats.visitors, comparison.visitors),
                        stats.range,
                    )}
                />
                <StatCard
                    label="Seitenaufrufe"
                    value={stats.stats.pageviews}
                    hint={deltaHint(
                        comparison === null
                            ? null
                            : deltaPercent(stats.stats.pageviews, comparison.pageviews),
                        stats.range,
                    )}
                />
                <StatCard
                    label="Besuche"
                    value={stats.stats.visits}
                    hint={deltaHint(
                        comparison === null
                            ? null
                            : deltaPercent(stats.stats.visits, comparison.visits),
                        stats.range,
                    )}
                />
            </div>
            {recent.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Aufrufe pro Tag</CardTitle>
                        <CardDescription>{`Tageswerte der ${rangeHint(stats.range)}.`}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ol className="flex flex-col gap-1.5">
                            {recent.map((point) => (
                                <li
                                    className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-xs"
                                    key={point.t}
                                >
                                    <span className="text-muted-foreground">
                                        {formatDate(point.t)}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="h-2 rounded-sm bg-primary/70"
                                        style={{width: `${Math.max(2, Math.round((point.y / max) * 100))}%`}}
                                    />
                                    <span className="text-right font-medium tabular-nums">
                                        {point.y}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            ) : null}
            <div>
                <UmamiOpenButton umamiHostUrl={umamiHostUrl} websiteId={websiteId} />
            </div>
        </div>
    )
}

/**
 * Tenant statistics dashboard (issue #191).
 *
 * Aggregates first-party data the studio can already fetch — content inventory
 * per desk plus subscriber/revenue stats when SUBSCRIPTION is on. Live Umami
 * reader stats come from the API (`/api/v1/tenant/analytics/stats/{range}` via
 * the tenant proxy), which keeps the Umami credentials server-side and resolves
 * the tenant's website from its branding.
 */
export default function AnalyticsDashboardClient({
    desks,
    subscriptionEnabled,
    analyticsModuleEnabled,
    analytics,
}: AnalyticsDashboardProps): React.JSX.Element {
    const dict = useDictionary()
    const a = dict.analytics
    const authRedirect = useAuthRequired()
    const showWrite = desks.includes('WRITE')
    const showPodcast = desks.includes('PODCAST')
    const [episodes, setEpisodes] = useState<EpisodeSummary[]>([])
    const [articles, setArticles] = useState<ArticleSummary[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [billing, setBilling] = useState<BillingDashboard | null>(null)
    const [billingFailure, setBillingFailure] = useState<'forbidden' | 'failed' | null>(null)
    const [umami, setUmami] = useState<UmamiStats | null>(null)
    const [umamiRange, setUmamiRange] = useState<UmamiRange>('30d')
    const [umamiKeyMissing, setUmamiKeyMissing] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(showWrite || showPodcast)
    const [attempt, setAttempt] = useState(0)
    const umamiActive = analyticsModuleEnabled && analytics !== null

    useEffect(() => {
        if (!showWrite && !showPodcast) {
            return
        }
        let active = true

        async function load(): Promise<void> {
            setErrorMessage(null)
            setIsLoading(true)
            try {
                const [loadedArticles, loadedEpisodes, loadedSeries] = await Promise.all([
                    showWrite ? listAllArticles() : Promise.resolve([]),
                    showPodcast ? listAllEpisodes() : Promise.resolve([]),
                    showPodcast ? listSeries() : Promise.resolve([]),
                ])
                if (!active) {
                    return
                }
                setArticles(loadedArticles)
                setEpisodes(loadedEpisodes)
                setSeries(loadedSeries)
            } catch (error: unknown) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : a.loadFailed,
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [a.loadFailed, authRedirect, attempt, showPodcast, showWrite])

    // Billing is independent of the content desks: a subscription-only tenant has no
    // WRITE/PODCAST desk, and the content effect returned early before fetching it (#1066).
    useEffect(() => {
        if (!subscriptionEnabled) {
            return
        }
        let active = true

        void (async () => {
            try {
                const loaded = await getBillingDashboard()
                if (active) {
                    setBilling(loaded)
                    setBillingFailure(null)
                }
            } catch (billingError: unknown) {
                if (!active) {
                    return
                }
                if (billingError instanceof Error && authRedirect(billingError)) {
                    return
                }
                // Only a 403 means "editors cannot see this"; a 500/timeout must not tell an
                // admin they lack rights and must stay retryable (#1066 review).
                setBilling(null)
                setBillingFailure(
                    (billingError as {status?: number} | null)?.status === 403
                        ? 'forbidden'
                        : 'failed',
                )
            }
        })()

        return () => {
            active = false
        }
    }, [attempt, authRedirect, subscriptionEnabled])

    useEffect(() => {
        if (!umamiActive) {
            return
        }
        let active = true
        setUmami(null)
        setUmamiKeyMissing(false)

        async function loadUmami(): Promise<void> {
            try {
                const stats = await getUmamiStats( umamiRange)
                if (active) {
                    setUmami(stats)
                }
            } catch (error: unknown) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                if (apiErrorStatus(error) === 503) {
                    setUmamiKeyMissing(true)
                }
                setUmami(null)
            }
        }

        void loadUmami()

        return () => {
            active = false
        }
    }, [authRedirect, attempt, umamiActive, umamiRange])

    if (isLoading) {
        return (
            <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4" role="status">
                <span className="sr-only">{a.loadingStats}</span>
                <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            </div>
        )
    }

    if (errorMessage !== null) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
                <Button
                    className="mt-3"
                    onClick={() => {
                        setAttempt((value) => value + 1)
                    }}
                    type="button"
                    variant="outline"
                >
                    {a.reload}
                </Button>
            </Alert>
        )
    }

    const publishedEpisodes = recentPublished(episodes)
    const publishedArticles = recentPublished(articles)

    return (
        <div className="flex flex-col gap-8">
            {showWrite || showPodcast ? (
                <section aria-label={a.contentSection} className="flex flex-col gap-4">
                    <SectionHeader
                        description={a.veroeffentlichteInhalteEntwuerfeGeplanteBeit}
                        title={a.contentSection}
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                        {showWrite ? (
                            <>
                                <StatCard
                                    label={dict.analytics.beitraegeVeroeffentlicht}
                                    value={countByStatus(articles, 'PUBLISHED')}
                                    hint={`${articles.length} Beiträge insgesamt`}
                                />
                                <StatCard
                                    label={dict.analytics.beitraegeArbeit}
                                    value={
                                        countByStatus(articles, 'DRAFT') +
                                        countByStatus(articles, 'SCHEDULED')
                                    }
                                    hint="Entwürfe und geplante Beiträge"
                                />
                            </>
                        ) : null}
                        {showPodcast ? (
                            <>
                                <StatCard
                                    label={dict.analytics.folgenVeroeffentlicht}
                                    value={countByStatus(episodes, 'PUBLISHED')}
                                    hint={`${episodes.length} Folgen insgesamt`}
                                />
                                <StatCard
                                    label="Folgen in Arbeit"
                                    value={
                                        countByStatus(episodes, 'DRAFT') +
                                        countByStatus(episodes, 'SCHEDULED')
                                    }
                                    hint="Entwürfe und geplante Folgen"
                                />
                                <StatCard
                                    label={dict.nav.podcast.series}
                                    value={series.length}
                                    hint={`${countByStatus(series, 'PUBLISHED')} veröffentlicht`}
                                />
                            </>
                        ) : null}
                    </div>
                    {publishedEpisodes.length > 0 || publishedArticles.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {publishedArticles.length > 0 ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Neueste Beiträge</CardTitle>
                                        <CardDescription>
                                            Die zuletzt veröffentlichten Beiträge.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="flex flex-col gap-2 text-sm">
                                            {publishedArticles.map((item) => (
                                                <li
                                                    className="flex items-baseline justify-between gap-3"
                                                    key={(item as ArticleSummary).id}
                                                >
                                                    <span className="truncate font-medium">
                                                        {(item as ArticleSummary).title}
                                                    </span>
                                                    <span className="shrink-0 text-muted-foreground">
                                                        {formatDate(item.publishedAt)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ) : null}
                            {publishedEpisodes.length > 0 ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Neueste Folgen</CardTitle>
                                        <CardDescription>
                                            Die zuletzt veröffentlichten Folgen.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="flex flex-col gap-2 text-sm">
                                            {publishedEpisodes.map((item) => (
                                                <li
                                                    className="flex items-baseline justify-between gap-3"
                                                    key={(item as EpisodeSummary).id}
                                                >
                                                    <span className="truncate font-medium">
                                                        {(item as EpisodeSummary).title}
                                                    </span>
                                                    <span className="shrink-0 text-muted-foreground">
                                                        {formatDate(item.publishedAt)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            ) : null}
                        </div>
                    ) : null}
                </section>
            ) : null}

            {subscriptionEnabled ? (
                <section aria-label="Publikum und Umsatz" className="flex flex-col gap-4">
                    <SectionHeader
                        description={a.audienceRevenueDescription}
                        title={a.audienceRevenue}
                    />
                    {billing !== null ? (
                        <div className="grid gap-4 sm:grid-cols-3">
                            <StatCard
                                label="Aktive Mitgliedschaften"
                                value={billing.stats.activeSubscriptions}
                                hint={`${billing.stats.uniqueActiveMembers} aktive Mitglieder`}
                            />
                            <StatCard
                                label="Bezahlt / Freischaltungen"
                                value={`${billing.stats.activePaidSubscriptions} / ${billing.stats.activeGrantSubscriptions}`}
                                hint="Zahlende Abos gegenüber manuellen Freischaltungen"
                            />
                            <StatCard
                                label={dict.analytics.geschaetzterMonatsumsatz}
                                value={billing.stats.monthlyTotals.length === 0
                                    ? '–'
                                    : billing.stats.monthlyTotals
                                          .map((total) => formatMoney(total.amountCents, total.currency))
                                          .join(" · ")}
                                hint={`+${billing.stats.newThisMonth} / −${billing.stats.canceledThisMonth} diesen Monat`}
                            />
                        </div>
                    ) : billingFailure === 'forbidden' ? (
                        <Card>
                            <CardContent className="pt-6 text-sm text-muted-foreground">
                                Abo-Kennzahlen sind nur für Tenant-Admins sichtbar.
                            </CardContent>
                        </Card>
                    ) : billingFailure === 'failed' ? (
                        <Card>
                            <CardContent className="flex flex-col items-start gap-3 pt-6 text-sm text-muted-foreground">
                                <p>Abo-Kennzahlen konnten nicht geladen werden.</p>
                                <Button
                                    onClick={() => {
                                        setAttempt((value) => value + 1)
                                    }}
                                    type="button"
                                    variant="outline"
                                >
                                    {a.reload}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card aria-busy="true">
                            <CardContent className="pt-6 text-sm text-muted-foreground" role="status">
                                Abo-Kennzahlen werden geladen…
                            </CardContent>
                        </Card>
                    )}
                </section>
            ) : null}

            <section aria-label={a.reachUmami} className="flex flex-col gap-4">
                <SectionHeader
                    description={a.reachDescription}
                    title={a.reachUmami}
                    action={
                        umamiActive ? (
                            <span className="flex gap-1" role="group" aria-label="Zeitraum">
                                {UMAMI_RANGES.map((option) => (
                                    <Button
                                        key={option.value}
                                        onClick={() => setUmamiRange(option.value)}
                                        size="sm"
                                        type="button"
                                        variant={umamiRange === option.value ? 'secondary' : 'ghost'}
                                    >
                                        {option.label}
                                    </Button>
                                ))}
                            </span>
                        ) : undefined
                    }
                />
                {umamiActive && analytics !== null ? (
                    umami !== null ? (
                        <UmamiLiveStats stats={umami} umamiHostUrl={analytics.umamiHostUrl} websiteId={analytics.umamiWebsiteId} />
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Messung aktiv</CardTitle>
                                <CardDescription>
                                    {`Reichweite wird über ${analytics.umamiHostUrl} gemessen.`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3 text-sm">
                                <p className="text-muted-foreground">
                                    {umamiKeyMissing
                                        ? 'Live-Kennzahlen sind noch nicht verfügbar: Auf dem API-Server fehlen die Umami-Zugangsdaten (DIRECTWERK_ANALYTICS_UMAMI_USERNAME/DIRECTWERK_ANALYTICS_UMAMI_PASSWORD).'
                                        : 'Live-Kennzahlen konnten nicht geladen werden.'}
                                </p>
                                <div>
                                    <UmamiOpenButton
                                        umamiHostUrl={analytics.umamiHostUrl}
                                        websiteId={analytics.umamiWebsiteId}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Noch nicht eingerichtet</CardTitle>
                            <CardDescription>
                                Verknüpfe eine Umami-Website, um Reichweite zu messen.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
                            <p>
                                {analyticsModuleEnabled
                                    ? a.hinterlegeUmamiWebsiteBrandingDanach
                                    : a.aktiviereAnalyticsModulHinterlegeUmamiWebsi}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </section>
        </div>
    )
}
