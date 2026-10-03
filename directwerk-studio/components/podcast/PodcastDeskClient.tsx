'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
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
    const dict = useDictionary()
    const p = dict.podcast
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
                        : p.overviewLoadFailed,
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
    }, [authRedirect, p.overviewLoadFailed, router])

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {p.overviewLoading}
            </p>
        )
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
            title: p.setupStep1Show,
            description: p.showIsChannel,
            done: hasSeries,
            href: hasSeries ? '/podcast/series' : '/podcast/series/new',
            actionLabel: hasSeries ? p.viewShows : p.createShow,
        },
        {
            id: 'formats',
            title: p.setupStep2Formats,
            description: p.formatsGroupEpisodes,
            done: hasFormats,
            href: hasFormats ? '/podcast/formats' : '/podcast/formats/new',
            actionLabel: hasFormats ? p.viewFormats : p.createFormats,
        },
        {
            id: 'episode',
            title: p.setupStep3Episode,
            description: p.step3EpisodeDescription,
            done: hasEpisodes,
            href: '/podcast/episodes/new',
            actionLabel: p.newEpisode,
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
        <PageStack>
            <PageHeader
                eyebrow={dict.desks.podcast}
                title={dict.desks.createContent}
                description={p.publishEpisodeByEpisode}
                actions={
                    setupComplete ? (
                        <div className="flex flex-wrap gap-2">
                            <Button nativeButton={false} render={<LocaleLink href="/podcast/import" />} size="lg" variant="outline">
                                {p.importRss}
                            </Button>
                            <Button nativeButton={false} render={<LocaleLink href="/podcast/episodes/new" />} size="lg">
                                {p.newEpisode}
                            </Button>
                        </div>
                    ) : (
                        <Button nativeButton={false} render={<LocaleLink href={nextStep.href} />} size="lg">
                            {nextStep.actionLabel}
                        </Button>
                    )
                }
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            <section aria-labelledby="podcast-flow-heading" className="flex flex-col gap-4">
                <SectionHeader
                    description={p.basicsThenPublish}
                    id="podcast-flow-heading"
                    title={p.howEpisodeWorks}
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
                                    <Badge variant={step.done ? 'secondary' : 'outline'}>
                                        {step.done ? dict.common.done : dict.common.openStep}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href={step.href} />}
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
                    title={p.emptyShowsTitle}
                    description={p.createShowThenFormats}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/podcast/series/new" />}>
                            {p.createFirstShow}
                        </Button>
                    }
                />
            ) : null}

            {setupComplete && draftEpisodes.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader title={p.openDrafts} />
                    <EntityListSection
                        items={draftEpisodeItems}
                        linkComponent={LocaleLink}
                        onViewModeChange={setViewMode}
                        showSelection={false}
                        viewMode={viewMode}
                    />
                    {draftEpisodes.length > 5 ? (
                        <p className="text-sm text-muted-foreground">
                            <LocaleLink href="/podcast/episodes">{p.showAllEpisodes}</LocaleLink>
                        </p>
                    ) : null}
                </section>
            ) : null}

            {setupComplete && publishedSeries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {p.draftShowBeforeLink}{' '}
                    <LocaleLink href={`/podcast/series/${series[0].id}`}>
                        {p.sendungVeroeffentlichen}
                    </LocaleLink>
                    {p.draftShowAfterLink}
                </p>
            ) : null}

            {setupComplete ? (
                <p className="text-sm text-muted-foreground">
                    <LocaleLink href="/podcast/episodes">{p.toEpisodeList}</LocaleLink>
                    {' · '}
                    <LocaleLink href="/podcast/import">{p.importRss}</LocaleLink>
                    {' · '}
                    <LocaleLink href="/podcast/series">{dict.nav.podcast.series}</LocaleLink>
                    {' · '}
                    <LocaleLink href="/podcast/formats">{dict.nav.podcast.formats}</LocaleLink>
                </p>
            ) : null}
        </PageStack>
    )
}
