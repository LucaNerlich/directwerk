'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import PublicationListSection from '@/components/publication/PublicationListSection'
import {listSeries, publishSeries, unpublishSeries} from '@/lib/api/podcastApi'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
import {runSequentialPublicationBulkAction} from '@/lib/publication/usePublicationBulkActions'
import {usePublicationListPage} from '@/lib/publication/usePublicationListPage'
import {getClientTenantHost} from '@directwerk/api/tenant'
import type {SeriesSummary} from '@directwerk/api/types'

type SeriesListItem = SeriesSummary & {publishedAt: null}

function toListItem(series: SeriesSummary): SeriesListItem {
    return {...series, publishedAt: null}
}

/**
 * Renders the podcast series management page with publication controls and creation links.
 */
export default function SeriesPageClient(): React.JSX.Element {
    const dict = useDictionary()
    const p = dict.podcast
    const {
        items: series,
        isLoading,
        displayError,
        statusMessage,
        reload: reloadSeries,
        busyItemId,
        isBulkBusy,
        selectedIds,
        allSelected,
        viewMode,
        setViewMode,
        toggleSelection,
        toggleSelectAll,
        publishableCount,
        unpublishableCount,
        handlePublish,
        handleUnpublish,
        handleBulkPublish,
        handleBulkUnpublish,
    } = usePublicationListPage<SeriesListItem>({
        load: async () => (await listSeries(getClientTenantHost())).map(toListItem),
        publish: async (id) => toListItem(await publishSeries(getClientTenantHost(), id)),
        unpublish: async (id) => toListItem(await unpublishSeries(getClientTenantHost(), id)),
        cancelSchedule: async () => {
            throw new Error(p.sendungenUnterstuetzenKeinePlanung)
        },
        unarchive: async () => {
            throw new Error(p.sendungenUnterstuetzenKeinArchiv)
        },
        // Series have no bulk endpoint: sequential per-item updates in one action.
        publishMany: async (ids) => {
            const host = getClientTenantHost()
            return runSequentialPublicationBulkAction(ids, async (id) =>
                toListItem(await publishSeries(host, id)),
            )
        },
        unpublishMany: async (ids) => {
            const host = getClientTenantHost()
            return runSequentialPublicationBulkAction(ids, async (id) =>
                toListItem(await unpublishSeries(host, id)),
            )
        },
        labels: {
            loadError: p.showsLoadFailed,
            publishSuccess: (title) => t(p.sendungVeroeffentlicht, {title}),
            unpublishSuccess: (title) => t(p.sendungZurueckgezogenEntwurf, {title}),
            cancelScheduleSuccess: () => '',
            unarchiveSuccess: () => '',
            publishError: p.sendungKonnteVeroeffentlicht,
            unpublishError: p.sendungKonnteZurueckgezogen,
            cancelScheduleError: '',
            unarchiveError: '',
            bulk: createPublicationBulkLabels(p.showSingular, p.showPlural),
        },
    })

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {p.showsLoading}
            </p>
        )
    }

    const listItems = series.map((item) => ({
        ...item,
        meta: item.slug,
    }))

    return (
        <PageStack className="gap-6">
            <PageHeader
                eyebrow={p.setupTitle}
                title={p.showsTitle}
                description={p.sendungPodcastKanalCoverBeschreibungRss}
                actions={
                    <Button nativeButton={false} render={<LocaleLink href="/podcast/series/new" />} size="lg">
                        {p.neueSendung}
                    </Button>
                }
            />

            {displayError !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{displayError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => void reloadSeries()}
                        type="button"
                        variant="outline"
                    >
                        {dict.common.retry}
                    </Button>
                </Alert>
            )}
            {statusMessage !== null && (
                <p className="text-sm text-muted-foreground" role="status">
                    {statusMessage}
                </p>
            )}

            {series.length === 0 ? (
                <EmptyState
                    title={p.emptyShowsTitle}
                    description={p.legeErsteSendungDanachFormateErste}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/podcast/series/new" />}>
                            {p.createFirstShow}
                        </Button>
                    }
                />
            ) : (
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        busyItemId={busyItemId}
                        contentLabelPlural={p.showPlural}
                        editorBasePath="/podcast/series"
                        isBulkBusy={isBulkBusy}
                        items={listItems}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onPublish={(item) => void handlePublish(item)}
                        onToggleSelectAll={toggleSelectAll}
                        onToggleSelection={toggleSelection}
                        onUnpublish={(item) => void handleUnpublish(item)}
                        onViewModeChange={setViewMode}
                        publishableCount={publishableCount}
                        selectedIds={selectedIds}
                        unpublishableCount={unpublishableCount}
                        viewMode={viewMode}
                    />
                </>
            )}

            {series.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                    {dict.common.nextStep}{' '}
                    <LocaleLink href="/podcast/formats">{p.formateFestlegen}</LocaleLink>
                    {' '}
                    {dict.common.or}{' '}
                    <LocaleLink href="/podcast/episodes/new">{p.folgeErstellen}</LocaleLink>.
                </p>
            ) : null}
        </PageStack>
    )
}
