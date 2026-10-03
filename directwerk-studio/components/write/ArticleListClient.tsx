'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {useCallback, useEffect, useMemo, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import PublicationListSection from '@/components/publication/PublicationListSection'
import BulkEditDialog, {type BulkEditOperation} from '@/components/publication/BulkEditDialog'
import BulkDeletePublicationDialog from '@/components/publication/BulkDeletePublicationDialog'
import DeletePublicationDialog from '@/components/publication/DeletePublicationDialog'
import {listCategories, replaceArticleCategories} from '@/lib/api/catalogApi'
import {
    bulkDeleteArticles,
    bulkPublishArticles,
    bulkUnpublishArticles,
    cancelScheduleArticle,
    deleteArticle,
    listArticles,
    publishArticle,
    unarchiveArticle,
    unpublishArticle,
    updateArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail, CategorySummary} from '@directwerk/api/types'
import {createPublicationBulkLabels} from '@/lib/publication/publicationBulkLabels'
import {usePublicationListPage} from '@/lib/publication/usePublicationListPage'
import {settledBulkResult} from '@/lib/publication/usePublicationBulkActions'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function ArticleListClient() {
    const dict = useDictionary()
    const w = dict.write
    const authRedirect = useAuthRequired()
    const {
        items: articles,
        isLoading,
        displayError,
        statusMessage,
        reload: reloadArticles,
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
        handleDelete,
        handleBulkPublish,
        handleBulkUnpublish,
        handleBulkDelete,
        runBulkEdit,
    } = usePublicationListPage<ArticleDetail>({
        load: () => listArticles(getClientTenantHost()),
        publish: (id) => publishArticle(getClientTenantHost(), id),
        unpublish: (id) => unpublishArticle(getClientTenantHost(), id),
        cancelSchedule: (id) => cancelScheduleArticle(getClientTenantHost(), id),
        unarchive: (id) => unarchiveArticle(getClientTenantHost(), id),
        remove: (id) => deleteArticle(getClientTenantHost(), id),
        publishMany: (ids) => settledBulkResult(bulkPublishArticles(getClientTenantHost(), {ids})),
        unpublishMany: (ids) => settledBulkResult(bulkUnpublishArticles(getClientTenantHost(), ids)),
        removeMany: (ids) => bulkDeleteArticles(getClientTenantHost(), ids),
        labels: {
            loadError: w.articlesLoadFailed,
            publishSuccess: (title) => t(w.articlePublishedToast, {title}),
            unpublishSuccess: (title) => t(w.articleUnpublishedToast, {title}),
            cancelScheduleSuccess: (title) => t(w.scheduleCancelledToast, {title}),
            unarchiveSuccess: (title) => t(w.articleRestoredToast, {title}),
            publishError: w.articlePublishFailed,
            unpublishError: w.articleUnpublishFailed,
            cancelScheduleError: w.scheduleCancelFailed,
            unarchiveError: w.articleRestoreFailed,
            deleteSuccess: (title) => t(w.articleDeletedToast, {title}),
            deleteError: w.articleDeleteFailed,
            bulk: createPublicationBulkLabels(w.articleSingular, w.articlePlural),
        },
    })

    const [deleteTarget, setDeleteTarget] = useState<ArticleDetail | null>(null)
    const [deletePending, setDeletePending] = useState(false)
    const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
    const [bulkDeletePending, setBulkDeletePending] = useState(false)

    const handleDeleteConfirm = useCallback(async (): Promise<void> => {
        if (deleteTarget === null || handleDelete === null) {
            return
        }
        const targetId = deleteTarget.id
        setDeletePending(true)
        try {
            await handleDelete(deleteTarget)
        } finally {
            setDeletePending(false)
            // Only close our own dialog: the user may have opened another
            // item's dialog while this delete was still pending.
            setDeleteTarget((current) =>
                current !== null && current.id === targetId ? null : current,
            )
        }
    }, [deleteTarget, handleDelete])

    const bulkDeleteItems = useMemo(
        () => articles.filter((article) => selectedIds.has(article.id)),
        [articles, selectedIds],
    )
    const handleBulkDeleteConfirm = useCallback(async (): Promise<void> => {
        if (handleBulkDelete === null) {
            return
        }
        setBulkDeletePending(true)
        try {
            await handleBulkDelete()
        } finally {
            setBulkDeletePending(false)
            setIsBulkDeleteOpen(false)
        }
    }, [handleBulkDelete])

    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
    const [categories, setCategories] = useState<CategorySummary[]>([])

    const loadCategories = useCallback(async (): Promise<void> => {
        try {
            setCategories(await listCategories(getClientTenantHost()))
        } catch (error: unknown) {
            if (authRedirect(error)) {
                return
            }
            setCategories([])
        }
    }, [authRedirect])

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
                        return Promise.reject(new Error(w.formatsNotForArticles))
                }
            }
            await runBulkEdit(
                eligible,
                apply,
                (count) =>
                    count === 1
                        ? w.oneArticleUpdated
                        : t(w.articlesUpdated, {count}),
                (successCount, failureCount) =>
                    t(w.articlesUpdatedPartial, {
                        successCount,
                        total: successCount + failureCount,
                    }),
                w.articlesUpdateFailed,
            )
            setIsBulkEditOpen(false)
        },
        [articles, runBulkEdit, selectedIds, w],
    )

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {w.articlesLoading}
            </p>
        )
    }

    return (
        <PageStack className="gap-6">
            <PageHeader
                eyebrow={dict.desks.write}
                title={w.articlesTitle}
                description={w.articlesListDescription}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button nativeButton={false} render={<LocaleLink href="/write/import" />} size="lg" variant="outline">
                            {w.importRss}
                        </Button>
                        <Button nativeButton={false} render={<LocaleLink href="/write/articles/new" />} size="lg">
                            {dict.shell.home.newArticle}
                        </Button>
                    </div>
                }
            />
            {displayError !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{displayError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => void reloadArticles()}
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
            {articles.length === 0 ? (
                <EmptyState
                    title={w.emptyArticlesTitle}
                    description={w.writeFirstDraftLater}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/write/articles/new" />}>
                            {w.writeFirstArticleCta}
                        </Button>
                    }
                />
            ) : (
                <>
                    <PublicationListSection
                        allSelected={allSelected}
                        busyItemId={busyArticleId}
                        contentLabelPlural={w.articlePlural}
                        editorBasePath="/write/articles"
                        isBulkBusy={isBulkBusy}
                        items={articles}
                        onBulkDelete={handleBulkDelete === null ? undefined : () => setIsBulkDeleteOpen(true)}
                        onBulkEdit={() => setIsBulkEditOpen(true)}
                        onBulkPublish={() => void handleBulkPublish()}
                        onBulkUnpublish={() => void handleBulkUnpublish()}
                        onCancelSchedule={(article) => void handleCancelSchedule(article)}
                        onDelete={handleDelete === null ? undefined : (article) => setDeleteTarget(article)}
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
                    <DeletePublicationDialog
                        contentLabel={w.articleSingular}
                        item={deleteTarget}
                        onConfirm={() => void handleDeleteConfirm()}
                        onOpenChange={(open) => {
                            if (!open && !deletePending) {
                                setDeleteTarget(null)
                            }
                        }}
                        open={deleteTarget !== null}
                        pending={deletePending}
                    />
                    <BulkDeletePublicationDialog
                        contentLabel={w.articleSingular}
                        contentLabelPlural={w.articlePlural}
                        items={bulkDeleteItems}
                        onConfirm={() => void handleBulkDeleteConfirm()}
                        onOpenChange={(open) => {
                            if (!open && !bulkDeletePending) {
                                setIsBulkDeleteOpen(false)
                            }
                        }}
                        open={isBulkDeleteOpen}
                        pending={bulkDeletePending}
                    />
                    <BulkEditDialog
                        busy={isBulkBusy}
                        categories={categories}
                        contentLabel={w.articleSingular}
                        draftCount={draftCount}
                        onApply={(operation) => void handleBulkEditApply(operation)}
                        onOpenChange={setIsBulkEditOpen}
                        open={isBulkEditOpen}
                        selectedCount={selectedIds.size}
                    />
                </>
            )}
        </PageStack>
    )
}
