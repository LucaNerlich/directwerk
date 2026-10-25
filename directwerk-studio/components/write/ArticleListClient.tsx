'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {useCallback, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'

import PublicationListClient from '@/components/publication/PublicationListClient'
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
import {settledBulkResult} from '@/lib/publication/usePublicationBulkActions'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function ArticleListClient() {
    const dict = useDictionary()
    const w = dict.write
    const authRedirect = useAuthRequired()
    const [categories, setCategories] = useState<CategorySummary[]>([])

    const loadCategories = useCallback(async (): Promise<void> => {
        try {
            setCategories(await listCategories())
        } catch (error: unknown) {
            if (authRedirect(error)) {
                return
            }
            setCategories([])
        }
    }, [authRedirect])

    return (
        <PublicationListClient<ArticleDetail>
            page={{
                load: (page) => listArticles(page),
                publish: (id) => publishArticle(id),
                unpublish: (id) => unpublishArticle(id),
                cancelSchedule: (id) => cancelScheduleArticle(id),
                unarchive: (id) => unarchiveArticle(id),
                remove: (id) => deleteArticle(id),
                publishMany: (ids) => settledBulkResult(bulkPublishArticles({ids})),
                unpublishMany: (ids) => settledBulkResult(bulkUnpublishArticles(ids)),
                removeMany: (ids) => bulkDeleteArticles(ids),
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
            }}
            loadingMessage={w.articlesLoading}
            header={{
                eyebrow: dict.desks.write,
                title: w.articlesTitle,
                description: w.articlesListDescription,
                actions: (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/write/import" />}
                            size="lg"
                            variant="outline"
                        >
                            {w.importRss}
                        </Button>
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/write/articles/new" />}
                            size="lg"
                        >
                            {dict.shell.home.newArticle}
                        </Button>
                    </div>
                ),
            }}
            contentLabel={w.articleSingular}
            contentLabelPlural={w.articlePlural}
            editorBasePath="/write/articles"
            retryLabel={dict.common.retry}
            renderEmpty={() => (
                <EmptyState
                    title={w.emptyArticlesTitle}
                    description={w.writeFirstDraftLater}
                    action={
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/write/articles/new" />}
                        >
                            {w.writeFirstArticleCta}
                        </Button>
                    }
                />
            )}
            bulkEdit={{
                categories,
                onOpen: () => {
                    if (categories.length === 0) {
                        void loadCategories()
                    }
                },
                onApply: async ({operation, eligible, runBulkEdit}) => {
                    const apply = (id: number): Promise<ArticleDetail> => {
                        switch (operation.kind) {
                            case 'categories':
                                return replaceArticleCategories(id, operation.categoryIds)
                            case 'accessPolicy':
                                return updateArticle(id, {
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
                },
            }}
        />
    )
}
