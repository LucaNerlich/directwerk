'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationListSection from '@/components/publication/PublicationListSection'
import {
    cancelScheduleArticle,
    listArticles,
    publishArticle,
    unarchiveArticle,
    unpublishArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail} from '@directwerk/api/types'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
import {usePublicationListPage} from '@/lib/publication/usePublicationListPage'
import {getClientTenantHost} from '@directwerk/api/tenant'

export default function ArticleListClient() {
    const {
        items: articles,
        isLoading,
        displayError,
        statusMessage,
        busyItemId: busyArticleId,
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
        handleCancelSchedule,
        handleUnarchive,
        handleBulkPublish,
        handleBulkUnpublish,
    } = usePublicationListPage<ArticleDetail>({
        load: () => listArticles(getClientTenantHost()),
        publish: (id) => publishArticle(getClientTenantHost(), id),
        unpublish: (id) => unpublishArticle(getClientTenantHost(), id),
        cancelSchedule: (id) => cancelScheduleArticle(getClientTenantHost(), id),
        unarchive: (id) => unarchiveArticle(getClientTenantHost(), id),
        labels: {
            loadError: 'Beiträge konnten nicht geladen werden.',
            publishSuccess: (title) => `Beitrag „${title}“ wurde veröffentlicht.`,
            unpublishSuccess: (title) =>
                `Beitrag „${title}“ wurde zurückgezogen (Entwurf).`,
            cancelScheduleSuccess: (title) =>
                `Planung für „${title}“ wurde aufgehoben (Entwurf).`,
            unarchiveSuccess: (title) =>
                `Beitrag „${title}“ wurde wiederhergestellt (Entwurf).`,
            publishError: 'Beitrag konnte nicht veröffentlicht werden.',
            unpublishError: 'Beitrag konnte nicht zurückgezogen werden.',
            cancelScheduleError: 'Planung konnte nicht aufgehoben werden.',
            unarchiveError: 'Beitrag konnte nicht wiederhergestellt werden.',
            bulk: createPublicationBulkLabels('Beitrag', 'Beiträge'),
        },
    })

    if (isLoading) {
        return <p>Beiträge werden geladen…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Schreiben"
                title="Beiträge"
                description="Artikel und Newsletter-Texte — mit Freigabe, Planung und Kategorien."
                actions={
                    <Button nativeButton={false} render={<Link href="/write/articles/new" />} size="lg">
                        Neuer Beitrag
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
            {articles.length === 0 ? (
                <EmptyState
                    title="Noch keine Beiträge"
                    description="Schreibe den ersten Entwurf. Veröffentlichen kannst du später."
                    action={
                        <Button nativeButton={false} render={<Link href="/write/articles/new" />}>
                            Ersten Beitrag schreiben
                        </Button>
                    }
                />
            ) : (
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        busyItemId={busyArticleId}
                        contentLabelPlural="Beiträge"
                        editorBasePath="/write/articles"
                        isBulkBusy={isBulkBusy}
                        items={articles}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onCancelSchedule={(article) => void handleCancelSchedule(article)}
                        onPublish={(article) => void handlePublish(article)}
                        onToggleSelectAll={toggleSelectAll}
                        onToggleSelection={toggleSelection}
                        onUnarchive={(article) => void handleUnarchive(article)}
                        onUnpublish={(article) => void handleUnpublish(article)}
                        onViewModeChange={setViewMode}
                        publishableCount={publishableCount}
                        selectedIds={selectedIds}
                        unpublishableCount={unpublishableCount}
                        viewMode={viewMode}
                    />
                </>
            )}
        </div>
    )
}
