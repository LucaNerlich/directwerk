'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import PublicationListSection from '@/components/publication/PublicationListSection'
import {listSeries, publishSeries, unpublishSeries} from '@/lib/api/podcastApi'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
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
            throw new Error('Sendungen unterstützen keine Planung.')
        },
        unarchive: async () => {
            throw new Error('Sendungen unterstützen kein Archiv.')
        },
        labels: {
            loadError: 'Sendungen konnten nicht geladen werden.',
            publishSuccess: (title) => `Sendung „${title}“ wurde veröffentlicht.`,
            unpublishSuccess: (title) =>
                `Sendung „${title}“ wurde zurückgezogen (Entwurf).`,
            cancelScheduleSuccess: () => '',
            unarchiveSuccess: () => '',
            publishError: 'Sendung konnte nicht veröffentlicht werden.',
            unpublishError: 'Sendung konnte nicht zurückgezogen werden.',
            cancelScheduleError: '',
            unarchiveError: '',
            bulk: createPublicationBulkLabels('Sendung', 'Sendungen'),
        },
    })

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                Sendungen werden geladen…
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
                eyebrow="Podcast · Einrichtung"
                title="Sendungen"
                description="Die Sendung ist dein Podcast-Kanal (Cover, Beschreibung, RSS). Einmal einrichten — der wöchentliche Flow läuft über Folgen."
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/series/new" />} size="lg">
                        Neue Sendung
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
                        Erneut versuchen
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
                    title="Noch keine Sendung"
                    description="Lege deine erste Sendung an, danach Formate und die erste Folge."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/series/new" />}>
                            Erste Sendung anlegen
                        </Button>
                    }
                />
            ) : (
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        busyItemId={busyItemId}
                        contentLabelPlural="Sendungen"
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
                    Nächster Schritt:{' '}
                    <Link href="/podcast/formats">Formate festlegen</Link>
                    {' '}
                    oder{' '}
                    <Link href="/podcast/episodes/new">Folge erstellen</Link>.
                </p>
            ) : null}
        </PageStack>
    )
}
