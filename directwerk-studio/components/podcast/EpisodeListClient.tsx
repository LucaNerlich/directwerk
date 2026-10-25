'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'

import PublicationListClient from '@/components/publication/PublicationListClient'
import {
    listCategories,
    listFormats,
    replaceEpisodeCategories,
    replaceEpisodeFormats,
} from '@/lib/api/catalogApi'
import {
    bulkDeleteEpisodes,
    bulkPublishEpisodes,
    bulkUnpublishEpisodes,
    cancelScheduleEpisode,
    deleteEpisode,
    listEpisodes,
    listSeries,
    publishEpisode,
    unarchiveEpisode,
    unpublishEpisode,
    updateEpisode,
} from '@/lib/api/podcastApi'
import type {
    CategorySummary,
    EpisodeDetail,
    FormatSummary,
    SeriesSummary,
} from '@directwerk/api/types'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
import {settledBulkResult} from '@/lib/publication/usePublicationBulkActions'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function EpisodeListClient() {
    const dict = useDictionary()
    const p = dict.podcast
    const authRedirect = useAuthRequired()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [prereqError, setPrereqError] = useState<string | null>(null)
    const [prereqLoading, setPrereqLoading] = useState(true)

    const loadPrerequisites = useCallback(async (): Promise<void> => {
        setPrereqLoading(true)
        setPrereqError(null)
        try {
            const [loadedSeries, loadedFormats, loadedCategories] = await Promise.all([
                listSeries(),
                listFormats(),
                listCategories().catch((error: unknown) => {
                    if (authRedirect(error)) {
                        throw error
                    }
                    return []
                }),
            ])
            setSeries(loadedSeries)
            setFormats(loadedFormats)
            setCategories(loadedCategories)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setPrereqError(
                error instanceof Error ? error.message : p.episodesLoadFailed,
            )
        } finally {
            setPrereqLoading(false)
        }
    }, [authRedirect, p.episodesLoadFailed])

    useEffect(() => {
        void loadPrerequisites()
    }, [loadPrerequisites])

    const seriesStatusById = useMemo(
        () => new Map(series.map((item) => [item.id, item.status])),
        [series],
    )
    const seriesTitleById = useMemo(
        () => new Map(series.map((item) => [item.id, item.title])),
        [series],
    )
    const publishBlockedReason = useCallback(
        (episode: EpisodeDetail): string | null =>
            seriesStatusById.get(episode.seriesId) === 'PUBLISHED'
                ? null
                : p.seriesMustPublishFirst,
        [p.seriesMustPublishFirst, seriesStatusById],
    )
    const isBulkPublishEligible = useCallback(
        (episode: EpisodeDetail): boolean =>
            seriesStatusById.get(episode.seriesId) === 'PUBLISHED',
        [seriesStatusById],
    )
    const isBulkUnpublishEligible = useCallback(
        (episode: EpisodeDetail): boolean => episode.status === 'PUBLISHED',
        [],
    )
    const mapItems = useCallback(
        (episodes: EpisodeDetail[]) =>
            episodes.map((episode) => ({
                ...episode,
                seriesLabel: seriesTitleById.get(episode.seriesId) ?? null,
            })),
        [seriesTitleById],
    )

    const hasSeries = series.length > 0
    const canCreate = hasSeries

    return (
        <PublicationListClient<EpisodeDetail>
            page={{
                load: (page) => listEpisodes(page),
                publish: (id) => publishEpisode(id),
                unpublish: (id) => unpublishEpisode(id),
                cancelSchedule: (id) => cancelScheduleEpisode(id),
                unarchive: (id) => unarchiveEpisode(id),
                remove: (id) => deleteEpisode(id),
                publishMany: (ids) => settledBulkResult(bulkPublishEpisodes({ids})),
                unpublishMany: (ids) => settledBulkResult(bulkUnpublishEpisodes(ids)),
                removeMany: (ids) => bulkDeleteEpisodes(ids),
                isBulkPublishEligible,
                isBulkUnpublishEligible,
                labels: {
                    loadError: p.episodesLoadFailed,
                    publishSuccess: (title) => t(p.folgeVeroeffentlicht, {title}),
                    unpublishSuccess: (title) => t(p.folgeZurueckgezogenEntwurf, {title}),
                    cancelScheduleSuccess: (title) =>
                        t(dict.write.scheduleCancelledToast, {title}),
                    unarchiveSuccess: (title) =>
                        t(p.folgeWiederhergestelltEntwurf, {title}),
                    publishError: p.folgeKonnteVeroeffentlicht,
                    unpublishError: p.folgeKonnteZurueckgezogen,
                    cancelScheduleError: dict.write.scheduleCancelFailed,
                    unarchiveError: p.folgeKonnteWiederhergestellt,
                    deleteSuccess: (title) => t(p.folgeGeloescht, {title}),
                    deleteError: p.folgeKonnteGeloescht,
                    bulk: createPublicationBulkLabels(p.episodeSingular, p.episodePlural),
                },
            }}
            loadingMessage={p.episodesLoading}
            header={{
                eyebrow: p.createTitle,
                title: p.episodesTitle,
                description: p.createDescription,
                actions: canCreate ? (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/podcast/import" />}
                            size="lg"
                            variant="outline"
                        >
                            {p.importRss}
                        </Button>
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/podcast/episodes/new" />}
                            size="lg"
                        >
                            {p.newEpisode}
                        </Button>
                    </div>
                ) : null,
            }}
            contentLabel={p.episodeSingular}
            contentLabelPlural={p.episodePlural}
            editorBasePath="/podcast/episodes"
            retryLabel={dict.common.retry}
            externalLoading={prereqLoading}
            externalError={prereqError}
            onRetry={() => {
                setPrereqError(null)
                void loadPrerequisites()
            }}
            mapItems={mapItems}
            publishBlockedReason={publishBlockedReason}
            renderAboveList={() => (
                <>
                    {!hasSeries ? (
                        <EmptyState
                            title={p.createShowFirstCard}
                            description={p.episodeBelongsToShow}
                            action={
                                <Button
                                    nativeButton={false}
                                    render={<LocaleLink href="/podcast/series/new" />}
                                >
                                    {p.createShow}
                                </Button>
                            }
                        />
                    ) : null}
                    {hasSeries && formats.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                            {p.noFormatsYetInline}{' '}
                            <LocaleLink href="/podcast/formats/new">{p.createFormats}</LocaleLink>
                            {' '}
                            {p.formatsRecommendedHint}
                        </div>
                    ) : null}
                </>
            )}
            renderEmpty={() =>
                hasSeries ? (
                    <EmptyState
                        title={p.emptyEpisodesTitle}
                        description={p.emptyEpisodesDescription}
                        action={
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href="/podcast/episodes/new" />}
                            >
                                {p.createFirstEpisode}
                            </Button>
                        }
                    />
                ) : null
            }
            bulkEdit={{
                categories,
                formats,
                onApply: async ({operation, eligible, runBulkEdit}) => {
                    const apply = (id: number): Promise<EpisodeDetail> => {
                        if (operation.kind === 'formats') {
                            return replaceEpisodeFormats(id, operation.formatIds)
                        }
                        if (operation.kind === 'categories') {
                            return replaceEpisodeCategories(id, operation.categoryIds)
                        }
                        return updateEpisode(id, {accessPolicy: operation.accessPolicy})
                    }
                    await runBulkEdit(
                        eligible,
                        apply,
                        (count) =>
                            count === 1
                                ? p['1FolgeAktualisiert']
                                : t(p.folgenAktualisiert, {count}),
                        (successCount, failureCount) =>
                            t(p.folgenAktualisiert2, {
                                successCount,
                                total: successCount + failureCount,
                            }),
                        p.folgenKonntenAktualisiert,
                    )
                },
            }}
        />
    )
}
