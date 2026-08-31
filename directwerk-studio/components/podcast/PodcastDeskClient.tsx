'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import SectionHeader from '@directwerk/ui/components/section-header'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listFormats} from '@/lib/api/catalogApi'
import {listEpisodes, listSeries} from '@/lib/api/podcastApi'
import type {SetupStep} from '@/lib/studio/setupStep'
import type {EpisodeSummary, FormatSummary, SeriesSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function PodcastDeskClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [episodes, setEpisodes] = useState<EpisodeSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [loadedSeries, loadedFormats, loadedEpisodes] = await Promise.all([
                    listSeries(host),
                    listFormats(host),
                    listEpisodes(host),
                ])
                if (!active) {
                    return
                }
                setSeries(loadedSeries)
                setFormats(loadedFormats)
                setEpisodes(loadedEpisodes)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Podcast-Übersicht konnte nicht geladen werden.',
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
    }, [router])

    if (isLoading) {
        return <p>Podcast-Übersicht wird geladen…</p>
    }

    const hasSeries = series.length > 0
    const hasFormats = formats.length > 0
    const hasEpisodes = episodes.length > 0
    const publishedSeries = series.filter((item) => item.status === 'PUBLISHED')
    const draftEpisodes = episodes.filter(
        (item) => item.status === 'DRAFT' || item.status === 'SCHEDULED',
    )

    const steps: SetupStep[] = [
        {
            id: 'series',
            title: '1. Sendung anlegen',
            description:
                'Die Sendung ist dein Podcast-Kanal: Titel, Cover und RSS-Metadaten. Einmal einrichten, selten ändern.',
            done: hasSeries,
            href: hasSeries ? '/podcast/series' : '/podcast/series/new',
            actionLabel: hasSeries ? 'Sendungen ansehen' : 'Sendung anlegen',
        },
        {
            id: 'formats',
            title: '2. Formate festlegen',
            description:
                'Formate gruppieren Folgen (z. B. Hauptfolge, Bonus, Interview) für Website und Feeds.',
            done: hasFormats,
            href: hasFormats ? '/podcast/formats' : '/podcast/formats/new',
            actionLabel: hasFormats ? 'Formate ansehen' : 'Formate anlegen',
        },
        {
            id: 'episode',
            title: '3. Folge erstellen',
            description:
                'Audio hochladen, Shownotes schreiben, Format wählen und veröffentlichen.',
            done: hasEpisodes,
            href: '/podcast/episodes/new',
            actionLabel: 'Neue Folge',
            primary: true,
        },
    ]

    const setupComplete = hasSeries
    const nextStep = steps.find((step) => !step.done) ?? steps[steps.length - 1]

    const draftEpisodeItems: EntityListViewItem[] = draftEpisodes.slice(0, 5).map((episode) => ({
        id: episode.id,
        title: episode.title,
        href: `/podcast/episodes/${episode.id}`,
        trailing: <PublicationStatusBadge status={episode.status} />,
    }))

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                eyebrow="Podcast"
                title="Inhalte erstellen"
                description="Folge für Folge veröffentlichen. Sendung und Formate sind Einrichtung — der wöchentliche Weg führt über die Folgen."
                actions={
                    setupComplete ? (
                        <div className="flex flex-wrap gap-2">
                            <Button nativeButton={false} render={<Link href="/podcast/import" />} size="lg" variant="outline">
                                RSS importieren
                            </Button>
                            <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />} size="lg">
                                Neue Folge
                            </Button>
                        </div>
                    ) : (
                        <Button nativeButton={false} render={<Link href={nextStep.href} />} size="lg">
                            {nextStep.actionLabel}
                        </Button>
                    )
                }
            />

            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}

            <section aria-labelledby="podcast-flow-heading" className="flex flex-col gap-4">
                <SectionHeader
                    description="Erst die Basis, dann regelmäßig Folgen veröffentlichen."
                    id="podcast-flow-heading"
                    title="So entsteht eine Folge"
                />
                <ol className="grid gap-3">
                    {steps.map((step) => (
                        <li
                            key={step.id}
                            className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{step.title}</p>
                                    <span
                                        className={
                                            step.done
                                                ? 'text-xs font-medium text-emerald-700'
                                                : 'text-xs font-medium text-muted-foreground'
                                        }
                                    >
                                        {step.done ? 'Erledigt' : 'Offen'}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                            <Button
                                nativeButton={false}
                                render={<Link href={step.href} />}
                                size="sm"
                                variant={
                                    step.primary && setupComplete
                                        ? 'default'
                                        : step.done
                                          ? 'outline'
                                          : 'secondary'
                                }
                            >
                                {step.actionLabel}
                            </Button>
                        </li>
                    ))}
                </ol>
            </section>

            {!setupComplete ? (
                <EmptyState
                    title="Noch keine Sendung"
                    description="Lege zuerst eine Sendung an. Danach kannst du Formate definieren und die erste Folge erstellen."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/series/new" />}>
                            Erste Sendung anlegen
                        </Button>
                    }
                />
            ) : null}

            {setupComplete && draftEpisodes.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader title="Offene Entwürfe" />
                    <EntityListSection
                        items={draftEpisodeItems}
                        linkComponent={Link}
                        onViewModeChange={setViewMode}
                        showSelection={false}
                        viewMode={viewMode}
                    />
                    {draftEpisodes.length > 5 ? (
                        <p className="text-sm text-muted-foreground">
                            <Link href="/podcast/episodes">Alle Folgen anzeigen</Link>
                        </p>
                    ) : null}
                </section>
            ) : null}

            {setupComplete && publishedSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Deine Sendung ist noch ein Entwurf.{' '}
                    <Link href={`/podcast/series/${series[0].id}`}>
                        Sendung veröffentlichen
                    </Link>
                    , damit der öffentliche Feed erscheint.
                </p>
            ) : null}

            {setupComplete ? (
                <p className="text-sm text-muted-foreground">
                    <Link href="/podcast/episodes">Zur Folgenliste</Link>
                    {' · '}
                    <Link href="/podcast/import">RSS importieren</Link>
                    {' · '}
                    <Link href="/podcast/series">Sendungen</Link>
                    {' · '}
                    <Link href="/podcast/formats">Formate</Link>
                </p>
            ) : null}
        </div>
    )
}
