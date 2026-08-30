'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationListToolbar from '@/components/publication/PublicationListToolbar'
import PublicationListView from '@/components/publication/PublicationListView'
import {listSeries, publishSeries, unpublishSeries} from '@/lib/api/podcastApi'
import {useSeriesListPage} from '@/lib/publication/useSeriesListPage'
import {getClientTenantHost} from '@directwerk/api/tenant'

export default function SeriesPageClient(): React.JSX.Element {
    const {
        items: series,
        isLoading,
        displayError,
        statusMessage,
        busyItemId,
        isBulkBusy,
        selectedIds,
        selectedCount,
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
    } = useSeriesListPage({
        load: () => listSeries(getClientTenantHost()),
        publish: (id) => publishSeries(getClientTenantHost(), id),
        unpublish: (id) => unpublishSeries(getClientTenantHost(), id),
    })

    if (isLoading) {
        return <p>Sendungen werden geladen…</p>
    }

    const listItems = series.map((item) => ({
        ...item,
        meta: item.slug,
    }))

    return (
        <div className="flex flex-col gap-6">
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
                <p className="text-sm text-destructive" role="alert">
                    {displayError}
                </p>
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
                    <PublicationListToolbar
                        allSelected={allSelected}
                        contentLabelPlural="Sendungen"
                        isBulkBusy={isBulkBusy}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onToggleSelectAll={toggleSelectAll}
                        onViewModeChange={setViewMode}
                        publishableCount={publishableCount}
                        selectedCount={selectedCount}
                        unpublishableCount={unpublishableCount}
                        viewMode={viewMode}
                    />
                    <PublicationListView
                        busyItemId={busyItemId}
                        editorBasePath="/podcast/series"
                        isBulkBusy={isBulkBusy}
                        items={listItems}
                        onCancelSchedule={() => {}}
                        onPublish={(item) => void handlePublish(item)}
                        onToggleSelection={toggleSelection}
                        onUnarchive={() => {}}
                        onUnpublish={(item) => void handleUnpublish(item)}
                        selectedIds={selectedIds}
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
        </div>
    )
}
