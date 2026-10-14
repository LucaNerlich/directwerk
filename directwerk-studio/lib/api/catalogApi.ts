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

export async function listFormats(): Promise<FormatSummary[]> {
    return studioGet(
        '/api/proxy/formats',
        
        parseFormatListEnvelope,
        'Der Server hat eine ungültige Formatliste gesendet.',
    )
}

export async function listCategories(
    ): Promise<CategorySummary[]> {
    return studioGet(
        '/api/proxy/categories',
        
        parseCategoryListEnvelope,
        'Der Server hat eine ungültige Kategorieliste gesendet.',
    )
}

export async function createFormat(
        input: CreateFormatInput,
): Promise<FormatSummary> {
    return studioMutate(
        '/api/proxy/formats',
        
        jsonInit('POST', input),
        parseFormatEnvelope,
        invalidFormatMessage,
    )
}

export async function updateFormat(
        formatId: number,
    input: UpdateFormatInput,
): Promise<FormatSummary> {
    return studioMutate(
        `/api/proxy/formats/${formatId}`,
        
        jsonInit('PUT', input),
        parseFormatEnvelope,
        invalidFormatMessage,
    )
}

export async function deactivateFormat(
        formatId: number,
): Promise<FormatSummary> {
    return studioMutate(
        `/api/proxy/formats/${formatId}`,
        
        {method: 'DELETE'},
        parseFormatEnvelope,
        invalidFormatMessage,
    )
}

export async function createCategory(
        input: CreateCategoryInput,
): Promise<CategorySummary> {
    return studioMutate(
        '/api/proxy/categories',
        
        jsonInit('POST', input),
        parseCategoryEnvelope,
        invalidCategoryMessage,
    )
}

export async function updateCategory(
        categoryId: number,
    input: UpdateCategoryInput,
): Promise<CategorySummary> {
    return studioMutate(
        `/api/proxy/categories/${categoryId}`,
        
        jsonInit('PUT', input),
        parseCategoryEnvelope,
        invalidCategoryMessage,
    )
}

export async function deactivateCategory(
        categoryId: number,
): Promise<CategorySummary> {
    return studioMutate(
        `/api/proxy/categories/${categoryId}`,
        
        {method: 'DELETE'},
        parseCategoryEnvelope,
        invalidCategoryMessage,
    )
}

export async function replaceEpisodeFormats(
        episodeId: number,
    formatIds: number[],
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/formats`,
        
        jsonInit('PUT', {formatIds}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function replaceEpisodeCategories(
        episodeId: number,
    categoryIds: number[],
): Promise<EpisodeDetail> {
    return studioMutate(
        `/api/proxy/episodes/${episodeId}/categories`,
        
        jsonInit('PUT', {categoryIds}),
        parseEpisodeEnvelope,
        invalidEpisodeMessage,
    )
}

export async function replaceArticleCategories(
        articleId: number,
    categoryIds: number[],
): Promise<ArticleDetail> {
    return studioMutate(
        `/api/proxy/articles/${articleId}/categories`,
        
        jsonInit('PUT', {categoryIds}),
        parseArticleEnvelope,
        invalidArticleMessage,
    )
}

export async function replaceArticleNewsletterLists(
        articleId: number,
    newsletterListIds: number[],
): Promise<ArticleDetail> {
    return studioMutate(
        `/api/proxy/articles/${articleId}/newsletter-lists`,
        
        jsonInit('PUT', {newsletterListIds}),
        parseArticleEnvelope,
        invalidArticleMessage,
    )
}
