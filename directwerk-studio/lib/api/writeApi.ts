'use client'

import {
    parseArticleEnvelope,
    parseArticleListEnvelope,
    parseContentNotifyPreviewEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    ArticleDetail,
    BulkPublishInput,
    ContentNotifyPreview,
    CreateArticleInput,
    UpdateArticleInput,
} from '@directwerk/api/types'
import {parseBulkDeleteEnvelope} from '@directwerk/api/validation/catalog'
import {createPublicationWorkflowApi, jsonInit, studioDelete, studioGet, studioMutate} from './studioApiCore'

const articleApi = createPublicationWorkflowApi<
    ArticleDetail,
    CreateArticleInput,
    UpdateArticleInput
>({
    basePath: '/api/proxy/articles',
    parseEnvelope: parseArticleEnvelope,
    parseListEnvelope: parseArticleListEnvelope,
    messages: {
        list: 'Der Server hat eine ungültige Beitragsliste gesendet.',
        detail: 'Der Server hat einen ungültigen Beitrag gesendet.',
    },
})

export const listArticles = articleApi.list
export const getArticle = articleApi.get
export const createArticle = articleApi.create
export const updateArticle = articleApi.update
export const publishArticle = articleApi.publish
export const scheduleArticle = articleApi.schedule
export const cancelScheduleArticle = articleApi.cancelSchedule
export const unpublishArticle = articleApi.unpublish
export const archiveArticle = articleApi.archive
export const unarchiveArticle = articleApi.unarchive

const invalidArticleMessage = 'Der Server hat einen ungültigen Beitrag gesendet.'
const invalidBulkDeleteMessage = 'Der Server hat eine ungültige Löschantwort gesendet.'
const invalidNotifyPreviewMessage =
    'Der Server hat eine ungültige Benachrichtigungsvorschau gesendet.'

export async function getArticleNotifyPreview(articleId: number): Promise<ContentNotifyPreview> {
    return studioGet(
        `/api/proxy/articles/${articleId}/notify-preview`,
        parseContentNotifyPreviewEnvelope,
        invalidNotifyPreviewMessage,
    )
}

export async function notifyArticleSubscribers(articleId: number): Promise<ArticleDetail> {
    return studioMutate(
        `/api/proxy/articles/${articleId}/notify`,
        {method: 'POST'},
        parseArticleEnvelope,
        invalidArticleMessage,
    )
}

export async function deleteArticle(
        articleId: number,
): Promise<void> {
    return studioDelete(`/api/proxy/articles/${articleId}`, )
}

export async function bulkPublishArticles(
        input: BulkPublishInput,
): Promise<ArticleDetail[]> {
    return studioMutate(
        '/api/proxy/articles/bulk/publish',
        
        jsonInit('POST', input),
        parseArticleListEnvelope,
        invalidArticleMessage,
    )
}

export async function bulkUnpublishArticles(
        ids: number[],
): Promise<ArticleDetail[]> {
    return studioMutate(
        '/api/proxy/articles/bulk/unpublish',
        
        jsonInit('POST', {ids}),
        parseArticleListEnvelope,
        invalidArticleMessage,
    )
}

export async function bulkDeleteArticles(
        ids: number[],
): Promise<number[]> {
    const result = await studioMutate(
        '/api/proxy/articles/bulk/delete',
        
        jsonInit('POST', {ids}),
        parseBulkDeleteEnvelope,
        invalidBulkDeleteMessage,
    )
    return result.deletedIds
}
