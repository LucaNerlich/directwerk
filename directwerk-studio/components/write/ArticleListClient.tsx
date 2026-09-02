'use client'

import Link from 'next/link'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationListSection from '@/components/publication/PublicationListSection'
import BulkEditDialog, {type BulkEditOperation} from '@/components/publication/BulkEditDialog'
import {listCategories, replaceArticleCategories} from '@/lib/api/catalogApi'
import {
    cancelScheduleArticle,
    listArticles,
    publishArticle,
    unarchiveArticle,
    unpublishArticle,
    updateArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail, CategorySummary} from '@directwerk/api/types'
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
        runBulkEdit,
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

    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
    const [categories, setCategories] = useState<CategorySummary[]>([])

    const loadCategories = useCallback(async (): Promise<void> => {
        try {
            setCategories(await listCategories(getClientTenantHost()))
        } catch {
            setCategories([])
        }
    }, [])

    useEffect(() => {
        if (!isBulkEditOpen || categories.length > 0) {
            return
        }
        void loadCategories()
    }, [categories.length, isBulkEditOpen, loadCategories])

    const draftCount = useMemo(
        () =>
            articles.filter(
                (article) => selectedIds.has(article.id) && article.status === 'DRAFT',
            ).length,
        [articles, selectedIds],
    )

    const handleBulkEditApply = useCallback(
        async (operation: BulkEditOperation): Promise<void> => {
            const eligible = articles.filter(
                (article) => selectedIds.has(article.id) && article.status === 'DRAFT',
            )
            if (eligible.length === 0) {
                return
            }
            const host = getClientTenantHost()
            const apply = (id: number): Promise<ArticleDetail> => {
                switch (operation.kind) {
                    case 'categories':
                        return replaceArticleCategories(host, id, operation.categoryIds)
                    case 'accessPolicy':
                        return updateArticle(host, id, {
                            accessPolicy: operation.accessPolicy,
                        })
                    case 'formats':
                        return Promise.reject(
                            new Error('Beiträgen können keine Formate zugewiesen werden.'),
                        )
                }
            }
            await runBulkEdit(
                eligible,
                apply,
                (count) =>
                    count === 1
                        ? '1 Beitrag aktualisiert.'
                        : `${count} Beiträge aktualisiert.`,
                (successCount, failureCount) =>
                    `${successCount} von ${successCount + failureCount} Beiträgen aktualisiert.`,
                'Beiträge konnten nicht aktualisiert werden.',
            )
            setIsBulkEditOpen(false)
        },
        [articles, runBulkEdit, selectedIds],
    )

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
                        onBulkEdit={() => setIsBulkEditOpen(true)}
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
                    <BulkEditDialog
                        busy={isBulkBusy}
                        categories={categories}
                        contentLabel="Beitrag"
                        draftCount={draftCount}
                        onApply={(operation) => void handleBulkEditApply(operation)}
                        onOpenChange={setIsBulkEditOpen}
                        open={isBulkEditOpen}
                        selectedCount={selectedIds.size}
                    />
                </>
            )}
        </div>
    )
}
