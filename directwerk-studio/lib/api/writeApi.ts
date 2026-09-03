'use client'

import {parseArticleEnvelope, parseArticleListEnvelope} from '@directwerk/api/validation/catalog'

import type {
    ArticleDetail,
    CreateArticleInput,
    UpdateArticleInput,
} from '@directwerk/api/types'
import {createPublicationWorkflowApi, studioDelete} from './studioApiCore'

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

export async function deleteArticle(
    tenantHost: string,
    articleId: number,
): Promise<void> {
    return studioDelete(`/api/proxy/articles/${articleId}`, tenantHost)
}
