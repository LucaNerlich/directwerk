'use client'

import {parseArticleEnvelope, parseCategoryEnvelope, parseCategoryListEnvelope, parseEpisodeEnvelope, parseFormatEnvelope, parseFormatListEnvelope} from '@directwerk/api/validation/catalog'

import type {
    ArticleDetail,
    CategorySummary,
    CreateCategoryInput,
    CreateFormatInput,
    EpisodeDetail,
    FormatSummary,
    UpdateCategoryInput,
    UpdateFormatInput,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'

const invalidFormatMessage = 'Der Server hat ein ungültiges Format gesendet.'
const invalidCategoryMessage = 'Der Server hat eine ungültige Kategorie gesendet.'
const invalidEpisodeMessage = 'Der Server hat eine ungültige Folge gesendet.'
const invalidArticleMessage = 'Der Server hat einen ungültigen Beitrag gesendet.'

export async function listFormats(tenantHost: string): Promise<FormatSummary[]> {
    return studioGet(
        '/api/proxy/formats',
        tenantHost,
        parseFormatListEnvelope,
        'Der Server hat eine ungültige Formatliste gesendet.',
    )
}

export async function listCategories(
    tenantHost: string,
): Promise<CategorySummary[]> {
    return studioGet(
        '/api/proxy/categories',
        tenantHost,
        parseCategoryListEnvelope,
        'Der Server hat eine ungültige Kategorieliste gesendet.',
    )
}

export async function createFormat(
    tenantHost: string,
    input: CreateFormatInput,
): Promise<FormatSummary> {
    return studioMutate(
        '/api/proxy/formats',
        tenantHost,
        jsonInit('POST', input),
        parseFormatEnvelope,
        invalidFormatMessage,
    )
}

export async function updateFormat(
    tenantHost: string,
    formatId: number,
    input: UpdateFormatInput,
): Promise<FormatSummary> {
    return studioMutate(
        `/api/proxy/formats/${formatId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseFormatEnvelope,
        invalidFormatMessage,
    )
}

export async function deactivateFormat(
    tenantHost: string,
    formatId: number,
): Promise<FormatSummary> {
    return studioMutate(
        `/api/proxy/formats/${formatId}`,
        tenantHost,
        {method: 'DELETE'},
        parseFormatEnvelope,
        invalidFormatMessage,
    )
}

export async function createCategory(
    tenantHost: string,
    input: CreateCategoryInput,
): Promise<CategorySummary> {
    return studioMutate(
        '/api/proxy/categories',
        tenantHost,
        jsonInit('POST', input),
        parseCategoryEnvelope,
        invalidCategoryMessage,
    )
}

export async function updateCategory(
    tenantHost: string,
    categoryId: number,
    input: UpdateCategoryInput,
): Promise<CategorySummary> {
    return studioMutate(
        `/api/proxy/categories/${categoryId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseCategoryEnvelope,
        invalidCategoryMessage,
    )
}

export async function deactivateCategory(
    tenantHost: string,
    categoryId: number,
): Promise<CategorySummary> {
    return studioMutate(
        `/api/proxy/categories/${categoryId}`,
        tenantHost,
        {method: 'DELETE'},
        parseCategoryEnvelope,
        invalidCategoryMessage,
    )
}

export async function replaceEpisodeFormats(
    tenantHost: string,
    episodeId: number,
    formatIds: number[],
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/formats`,
        tenantHost,
        jsonInit('PUT', {formatIds}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function replaceEpisodeCategories(
    tenantHost: string,
    episodeId: number,
    categoryIds: number[],
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/categories`,
        tenantHost,
        jsonInit('PUT', {categoryIds}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function replaceArticleCategories(
    tenantHost: string,
    articleId: number,
    categoryIds: number[],
): Promise<ArticleDetail> {
    return studioMutate(
        `/api/proxy/articles/${articleId}/categories`,
        tenantHost,
        jsonInit('PUT', {categoryIds}),
        parseArticleEnvelope,
        invalidArticleMessage,
    )
}
