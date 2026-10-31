import * as fs from 'node:fs/promises'
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {z} from 'zod'
import {DirectwerkApiError, DirectwerkClient} from './client.js'

function toolResult(data: unknown) {
    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(data, null, 2),
            },
        ],
    }
}

function toolError(error: unknown) {
    if (error instanceof DirectwerkApiError) {
        return {
            isError: true as const,
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify(
                        {error: error.message, status: error.status, body: error.body},
                        null,
                        2,
                    ),
                },
            ],
        }
    }
    const message = error instanceof Error ? error.message : String(error)
    return {
        isError: true as const,
        content: [{type: 'text' as const, text: message}],
    }
}

const idSchema = z.coerce.number().int().positive()
const optionalLimit = z.coerce.number().int().min(1).max(100).optional()
const optionalOffset = z.coerce.number().int().min(0).optional()

export function createMcpServer(client: DirectwerkClient): McpServer {
    const server = new McpServer({
        name: 'directwerk-studio',
        version: '0.1.0',
    })

    const api = (method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>) =>
        client.request(method, path.startsWith('/') ? path.slice(1) : path, body, query)

    // --- Articles ---
    server.tool('list_articles', 'List articles for the tenant', {
        limit: optionalLimit,
        offset: optionalOffset,
        q: z.string().max(200).optional(),
    }, async (args) => {
        try {
            return toolResult(await api('GET', 'api/v1/articles', undefined, args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_article', 'Get one article by id', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('GET', `api/v1/articles/${articleId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_article', 'Create an article', {
        slug: z.string().min(1).max(120),
        title: z.string().min(1).max(500),
        body: z
            .string()
            .optional()
            .describe(
                'Article body: TipTap-shaped HTML preferred (p/h2/h3/lists/…); CommonMark also accepted. API converts Markdown to sanitized HTML on write.',
            ),
        excerpt: z.string().optional(),
        seoDescription: z.string().optional(),
        accessPolicy: z.enum(['FREE', 'PAID']),
        heroAssetId: idSchema.optional(),
        requiredLevelSortOrder: z.coerce.number().int().optional(),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/articles', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('update_article', 'Update an article', {
        articleId: idSchema,
        slug: z.string().min(1).max(120).optional(),
        title: z.string().min(1).max(500).optional(),
        body: z
            .string()
            .optional()
            .describe(
                'Article body: TipTap-shaped HTML preferred (p/h2/h3/lists/…); CommonMark also accepted. API converts Markdown to sanitized HTML on write.',
            ),
        excerpt: z.string().optional(),
        seoDescription: z.string().optional(),
        accessPolicy: z.enum(['FREE', 'PAID']).optional(),
        heroAssetId: idSchema.optional(),
        clearHeroAsset: z.boolean().optional(),
        requiredLevelSortOrder: z.coerce.number().int().optional(),
    }, async ({articleId, ...body}) => {
        try {
            return toolResult(await api('PUT', `api/v1/articles/${articleId}`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('delete_article', 'Delete an article', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('DELETE', `api/v1/articles/${articleId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('set_article_categories', 'Replace article categories', {
        articleId: idSchema,
        categoryIds: z.array(idSchema),
    }, async ({articleId, categoryIds}) => {
        try {
            return toolResult(await api('PUT', `api/v1/articles/${articleId}/categories`, {categoryIds}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('publish_article', 'Publish an article', {
        articleId: idSchema,
        notifySubscribers: z.boolean().optional(),
        publishedAt: z.string().optional(),
    }, async ({articleId, notifySubscribers, publishedAt}) => {
        try {
            const body: Record<string, unknown> = {}
            if (notifySubscribers !== undefined) {body.notifySubscribers = notifySubscribers}
            if (publishedAt !== undefined) {body.publishedAt = publishedAt}
            return toolResult(await api('POST', `api/v1/articles/${articleId}/publish`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('unpublish_article', 'Unpublish an article', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/unpublish`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('schedule_article', 'Schedule an article publish time (field matches backend: scheduledAt)', {
        articleId: idSchema,
        scheduledAt: z.string().min(1),
        notifySubscribers: z.boolean().optional(),
    }, async ({articleId, scheduledAt, notifySubscribers}) => {
        try {
            const body: Record<string, unknown> = {scheduledAt}
            if (notifySubscribers !== undefined) {body.notifySubscribers = notifySubscribers}
            return toolResult(await api('POST', `api/v1/articles/${articleId}/schedule`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('cancel_schedule_article', 'Cancel a scheduled article publish', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/cancel-schedule`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('archive_article', 'Archive an article', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/archive`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('unarchive_article', 'Unarchive an article', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/unarchive`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('notify_preview_article', 'Preview subscriber notification recipients for an article', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('GET', `api/v1/articles/${articleId}/notify-preview`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('notify_article', 'Send or retry subscriber notification for a published article', {
        articleId: idSchema,
    }, async ({articleId}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/notify`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('set_article_newsletter_lists', 'Replace article newsletter list attachments (list ids must already be known; list CRUD is not in MCP)', {
        articleId: idSchema,
        newsletterListIds: z.array(idSchema),
    }, async ({articleId, newsletterListIds}) => {
        try {
            return toolResult(await api('PUT', `api/v1/articles/${articleId}/newsletter-lists`, {newsletterListIds}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('bulk_publish_articles', 'Publish multiple articles (1-100 ids, atomic)', {
        ids: z.array(idSchema).min(1).max(100),
        notifySubscribers: z.boolean().optional(),
        publishedAt: z.string().optional(),
    }, async ({ids, notifySubscribers, publishedAt}) => {
        try {
            const body: Record<string, unknown> = {ids}
            if (notifySubscribers !== undefined) {body.notifySubscribers = notifySubscribers}
            if (publishedAt !== undefined) {body.publishedAt = publishedAt}
            return toolResult(await api('POST', 'api/v1/articles/bulk/publish', body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('bulk_unpublish_articles', 'Unpublish multiple articles (1-100 ids, atomic)', {
        ids: z.array(idSchema).min(1).max(100),
    }, async ({ids}) => {
        try {
            return toolResult(await api('POST', 'api/v1/articles/bulk/unpublish', {ids}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('bulk_delete_articles', 'Delete multiple articles (1-100 ids, atomic)', {
        ids: z.array(idSchema).min(1).max(100),
    }, async ({ids}) => {
        try {
            return toolResult(await api('POST', 'api/v1/articles/bulk/delete', {ids}))
        } catch (error) {
            return toolError(error)
        }
    })

    // --- Episodes ---
    server.tool('list_episodes', 'List episodes for the tenant', {
        limit: optionalLimit,
        offset: optionalOffset,
        seriesId: idSchema.optional(),
        q: z.string().max(200).optional(),
    }, async (args) => {
        try {
            return toolResult(await api('GET', 'api/v1/episodes', undefined, args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_episode', 'Get one episode by id', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('GET', `api/v1/episodes/${episodeId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_episode', 'Create an episode', {
        seriesId: idSchema,
        slug: z.string().min(1).max(120),
        title: z.string().min(1).max(500),
        description: z
            .string()
            .optional()
            .describe(
                'Show notes: TipTap-shaped HTML preferred; CommonMark also accepted. API converts Markdown to sanitized HTML on write.',
            ),
        accessPolicy: z.enum(['FREE', 'PAID']),
        episodeNumber: z.coerce.number().int().optional(),
        requiredLevelSortOrder: z.coerce.number().int().optional(),
        coverAssetId: idSchema.optional(),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/episodes', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('update_episode', 'Update an episode', {
        episodeId: idSchema,
        slug: z.string().min(1).max(120).optional(),
        title: z.string().min(1).max(500).optional(),
        description: z
            .string()
            .optional()
            .describe(
                'Show notes: TipTap-shaped HTML preferred; CommonMark also accepted. API converts Markdown to sanitized HTML on write.',
            ),
        accessPolicy: z.enum(['FREE', 'PAID']).optional(),
        episodeNumber: z.coerce.number().int().optional(),
        requiredLevelSortOrder: z.coerce.number().int().optional(),
        coverAssetId: idSchema.optional(),
        clearCoverAsset: z.boolean().optional(),
    }, async ({episodeId, ...body}) => {
        try {
            return toolResult(await api('PUT', `api/v1/episodes/${episodeId}`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('delete_episode', 'Delete an episode', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('DELETE', `api/v1/episodes/${episodeId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('set_episode_formats', 'Replace episode formats', {
        episodeId: idSchema,
        formatIds: z.array(idSchema),
    }, async ({episodeId, formatIds}) => {
        try {
            return toolResult(await api('PUT', `api/v1/episodes/${episodeId}/formats`, {formatIds}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('set_episode_categories', 'Replace episode categories', {
        episodeId: idSchema,
        categoryIds: z.array(idSchema),
    }, async ({episodeId, categoryIds}) => {
        try {
            return toolResult(await api('PUT', `api/v1/episodes/${episodeId}/categories`, {categoryIds}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('attach_episode_audio', 'Attach a media asset as episode audio', {
        episodeId: idSchema,
        audioAssetId: idSchema,
    }, async ({episodeId, audioAssetId}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/audio`, {audioAssetId}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('publish_episode', 'Publish an episode (optionally with an explicit publish date for imports)', {
        episodeId: idSchema,
        notifySubscribers: z.boolean().optional(),
        // Accept an explicit publishedAt (ISO instant) for back-dated imports.
        publishedAt: z.string().optional(),
    }, async ({episodeId, notifySubscribers, publishedAt}) => {
        try {
            const body: Record<string, unknown> = {}
            if (notifySubscribers !== undefined) {body.notifySubscribers = notifySubscribers}
            if (publishedAt !== undefined) {body.publishedAt = publishedAt}
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/publish`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('unpublish_episode', 'Unpublish an episode', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/unpublish`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('schedule_episode', 'Schedule an episode publish time (field matches backend: scheduledAt)', {
        episodeId: idSchema,
        scheduledAt: z.string().min(1),
        notifySubscribers: z.boolean().optional(),
    }, async ({episodeId, scheduledAt, notifySubscribers}) => {
        try {
            const body: Record<string, unknown> = {scheduledAt}
            if (notifySubscribers !== undefined) {body.notifySubscribers = notifySubscribers}
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/schedule`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('cancel_schedule_episode', 'Cancel a scheduled episode publish', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/cancel-schedule`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('archive_episode', 'Archive an episode', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/archive`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('unarchive_episode', 'Unarchive an episode', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/unarchive`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('set_episode_enclosure_enabled', 'Enable or disable the RSS enclosure for an episode', {
        episodeId: idSchema,
        enabled: z.boolean(),
    }, async ({episodeId, enabled}) => {
        try {
            return toolResult(await api('PUT', `api/v1/episodes/${episodeId}/enclosure-enabled`, {enabled}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('notify_preview_episode', 'Preview subscriber notification recipients for an episode', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('GET', `api/v1/episodes/${episodeId}/notify-preview`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('notify_episode', 'Send or retry subscriber notification for a published episode', {
        episodeId: idSchema,
    }, async ({episodeId}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/notify`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('bulk_publish_episodes', 'Publish multiple episodes (1-100 ids, atomic)', {
        ids: z.array(idSchema).min(1).max(100),
        notifySubscribers: z.boolean().optional(),
        publishedAt: z.string().optional(),
    }, async ({ids, notifySubscribers, publishedAt}) => {
        try {
            const body: Record<string, unknown> = {ids}
            if (notifySubscribers !== undefined) {body.notifySubscribers = notifySubscribers}
            if (publishedAt !== undefined) {body.publishedAt = publishedAt}
            return toolResult(await api('POST', 'api/v1/episodes/bulk/publish', body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('bulk_unpublish_episodes', 'Unpublish multiple episodes (1-100 ids, atomic)', {
        ids: z.array(idSchema).min(1).max(100),
    }, async ({ids}) => {
        try {
            return toolResult(await api('POST', 'api/v1/episodes/bulk/unpublish', {ids}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('bulk_delete_episodes', 'Delete multiple episodes (1-100 ids, atomic)', {
        ids: z.array(idSchema).min(1).max(100),
    }, async ({ids}) => {
        try {
            return toolResult(await api('POST', 'api/v1/episodes/bulk/delete', {ids}))
        } catch (error) {
            return toolError(error)
        }
    })

    // --- Series ---
    server.tool('list_series', 'List podcast series', {
        limit: optionalLimit,
        offset: optionalOffset,
    }, async (args) => {
        try {
            return toolResult(await api('GET', 'api/v1/series', undefined, args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_series', 'Get one series by id', {
        seriesId: idSchema,
    }, async ({seriesId}) => {
        try {
            return toolResult(await api('GET', `api/v1/series/${seriesId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_series', 'Create a podcast series', {
        slug: z.string().min(1).max(120),
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        coverAssetId: idSchema.optional(),
        language: z.string().optional(),
        itunesCategory: z.string().optional(),
        itunesExplicit: z.boolean().optional(),
        defaultRequiredLevelSortOrder: z.coerce.number().int().optional(),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/series', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('update_series', 'Update a podcast series', {
        seriesId: idSchema,
        slug: z.string().min(1).max(120).optional(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().optional(),
        coverAssetId: idSchema.optional(),
        language: z.string().optional(),
        itunesCategory: z.string().optional(),
        itunesExplicit: z.boolean().optional(),
        defaultRequiredLevelSortOrder: z.coerce.number().int().optional(),
        status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
    }, async ({seriesId, ...body}) => {
        try {
            return toolResult(await api('PUT', `api/v1/series/${seriesId}`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    // --- Categories ---
    server.tool('list_categories', 'List tenant categories', {}, async () => {
        try {
            return toolResult(await api('GET', 'api/v1/categories'))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_category', 'Create a category', {
        slug: z.string().min(1).max(120),
        name: z.string().min(1).max(200),
        parentId: idSchema.optional(),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/categories', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('update_category', 'Update a category', {
        categoryId: idSchema,
        slug: z.string().min(1).max(120).optional(),
        name: z.string().min(1).max(200).optional(),
        parentId: idSchema.optional(),
        clearParentId: z.boolean().optional(),
        active: z.boolean().optional(),
    }, async ({categoryId, ...body}) => {
        try {
            return toolResult(await api('PUT', `api/v1/categories/${categoryId}`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('delete_category', 'Delete a category', {
        categoryId: idSchema,
    }, async ({categoryId}) => {
        try {
            return toolResult(await api('DELETE', `api/v1/categories/${categoryId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    // --- Formats ---
    server.tool('list_formats', 'List podcast formats', {}, async () => {
        try {
            return toolResult(await api('GET', 'api/v1/formats'))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_format', 'Create a podcast format', {
        slug: z.string().min(1).max(120),
        name: z.string().min(1).max(200),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/formats', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('update_format', 'Update a podcast format', {
        formatId: idSchema,
        slug: z.string().min(1).max(120).optional(),
        name: z.string().min(1).max(200).optional(),
        active: z.boolean().optional(),
    }, async ({formatId, ...body}) => {
        try {
            return toolResult(await api('PUT', `api/v1/formats/${formatId}`, body))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('delete_format', 'Delete a podcast format', {
        formatId: idSchema,
    }, async ({formatId}) => {
        try {
            return toolResult(await api('DELETE', `api/v1/formats/${formatId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    // --- Media ---
    server.tool('list_media', 'List media assets', {
        limit: optionalLimit,
        offset: optionalOffset,
        folderId: idSchema.optional(),
        q: z.string().max(200).optional(),
    }, async (args) => {
        try {
            return toolResult(await api('GET', 'api/v1/media', undefined, args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_media', 'Get one media asset', {
        assetId: idSchema,
    }, async ({assetId}) => {
        try {
            return toolResult(await api('GET', `api/v1/media/${assetId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_media_upload_url', 'Request a pre-signed upload URL', {
        filename: z.string().min(1).max(255),
        mimeType: z.string().min(1).max(128),
        sizeBytes: z.coerce.number().int().positive(),
        assetType: z.enum(['AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT']),
        intendedVisibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
        folderId: idSchema.optional(),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/media/upload-url', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('confirm_media_upload', 'Confirm a completed media upload', {
        assetId: idSchema,
    }, async ({assetId}) => {
        try {
            return toolResult(await api('POST', `api/v1/media/${assetId}/confirm`, {}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('rename_media', 'Rename a media asset filename', {
        assetId: idSchema,
        filename: z.string().min(1).max(255),
    }, async ({assetId, filename}) => {
        try {
            return toolResult(await api('PUT', `api/v1/media/${assetId}`, {filename}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_media_preview_url', 'Get a short-lived preview URL for a media asset', {
        assetId: idSchema,
    }, async ({assetId}) => {
        try {
            return toolResult(await api('GET', `api/v1/media/${assetId}/preview-url`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('list_media_references', 'List content that references a media asset', {
        assetId: idSchema,
    }, async ({assetId}) => {
        try {
            return toolResult(await api('GET', `api/v1/media/${assetId}/references`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_media_limits', 'Get effective upload limits for the tenant', {}, async () => {
        try {
            return toolResult(await api('GET', 'api/v1/media/limits'))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('get_media_storage_summary', 'Get media storage usage summary for the tenant', {}, async () => {
        try {
            return toolResult(await api('GET', 'api/v1/media/storage-summary'))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('delete_media', 'Delete a media asset', {
        assetId: idSchema,
    }, async ({assetId}) => {
        try {
            return toolResult(await api('DELETE', `api/v1/media/${assetId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('move_media', 'Move a media asset into a folder', {
        assetId: idSchema,
        folderId: idSchema.nullable().optional(),
    }, async ({assetId, folderId}) => {
        try {
            return toolResult(await api('POST', `api/v1/media/${assetId}/move`, {folderId: folderId ?? null}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('list_media_folders', 'List media folders', {}, async () => {
        try {
            return toolResult(await api('GET', 'api/v1/media/folders'))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('create_media_folder', 'Create a media folder', {
        name: z.string().min(1).max(200),
        parentId: idSchema.optional(),
    }, async (args) => {
        try {
            return toolResult(await api('POST', 'api/v1/media/folders', args))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('update_media_folder', 'Rename a media folder', {
        folderId: idSchema,
        name: z.string().min(1).max(200),
    }, async ({folderId, name}) => {
        try {
            return toolResult(await api('PUT', `api/v1/media/folders/${folderId}`, {name}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('move_media_folder', 'Move a media folder under another parent', {
        folderId: idSchema,
        parentId: idSchema.nullable().optional(),
    }, async ({folderId, parentId}) => {
        try {
            return toolResult(await api('POST', `api/v1/media/folders/${folderId}/move`, {parentId: parentId ?? null}))
        } catch (error) {
            return toolError(error)
        }
    })

    server.tool('delete_media_folder', 'Delete a media folder', {
        folderId: idSchema,
    }, async ({folderId}) => {
        try {
            return toolResult(await api('DELETE', `api/v1/media/folders/${folderId}`))
        } catch (error) {
            return toolError(error)
        }
    })

    // --- Bulk import (Karo-type podcast episode manifests) ---
    // Reads a seller-provided JSON manifest; uploads local audio/cover files through
    // the usual upload-url -> PUT -> confirm flow, then creates/publishes episodes.
    // Idempotent: reuses READY assets by originalFilename and DRAFT episodes by slug.
    const slugPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$/

    const unwrap = (value: unknown): any =>
        value && typeof value === 'object' && 'data' in (value as Record<string, unknown>)
            ? (value as {data: unknown}).data
            : value

    async function collectList(path: string): Promise<any[]> {
        const items: any[] = []
        for (let offset = 0; ; offset += 100) {
            const page = unwrap(await api('GET', path, undefined, {limit: 100, offset})) as any[]
            if (!Array.isArray(page) || page.length === 0) {break}
            items.push(...page)
            if (page.length < 100) {break}
        }
        return items
    }

    interface ManifestFile {
        path?: string
        filename?: string
        mimeType?: string
        sizeBytes?: number
    }

    async function uploadAsset(file: ManifestFile, assetType: 'AUDIO' | 'IMAGE'): Promise<number> {
        if (!file?.path || !file?.filename || !file?.mimeType || !file?.sizeBytes) {
            throw new Error(`manifest item missing file descriptor: ${JSON.stringify(file)}`)
        }
        const upload = unwrap(await api('POST', 'api/v1/media/upload-url', {
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            assetType,
            intendedVisibility: 'PUBLIC',
        })) as {assetId: number, uploadUrl: string, headers?: Record<string, string>}
        const buffer = await fs.readFile(file.path)
        if (buffer.length !== file.sizeBytes) {
            throw new Error(`${file.filename}: size ${buffer.length} != manifest ${file.sizeBytes}`)
        }
        const put = await fetch(upload.uploadUrl, {
            method: 'PUT',
            headers: {'Content-Type': upload.headers?.['Content-Type'] ?? file.mimeType},
            body: buffer,
        })
        if (!put.ok) {
            throw new Error(`${file.filename}: S3 PUT failed (${put.status})`)
        }
        await api('POST', `api/v1/media/${upload.assetId}/confirm`, {})
        return upload.assetId
    }

    server.tool('import_podcast_manifest', 'Bulk-import podcast episodes from a local manifest JSON file', {
        manifestPath: z.string().min(1),
        limit: z.coerce.number().int().min(1).max(60).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        onlyNumbers: z.array(z.coerce.number().int()).optional(),
        formatIds: z.array(idSchema).optional(),
    }, async (args) => {
        try {
            const manifest = JSON.parse(await fs.readFile(args.manifestPath, 'utf8')) as {
                series: {slug: string},
                items: Array<{
                    n: number
                    slug: string
                    title: string
                    description?: string
                    publishedAt?: string
                    accessPolicy?: string
                    mp3?: ManifestFile
                    cover?: ManifestFile
                }>,
            }
            if (!manifest?.series?.slug || !Array.isArray(manifest.items)) {
                throw new Error('manifest must contain series.slug and items[]')
            }
            const seriesList = unwrap(await api('GET', 'api/v1/series')) as any[]
            const series = (seriesList ?? []).find(s => s.slug === manifest.series.slug)
            if (!series) {
                throw new Error(`series ${manifest.series.slug} not found`)
            }

            const existingEpisodes = (await collectList('api/v1/episodes'))
                .filter(e => e.seriesSlug === series.slug || e.seriesId === series.id)
            const bySlug = new Map(existingEpisodes.map(e => [e.slug, e]))

            const existingMedia = await collectList('api/v1/media')
            const mediaByFilename = new Map(
                existingMedia.map(a => [a.originalFilename, a]),
            )

            let items = [...manifest.items].sort((a, b) => a.n - b.n)
            if (args.onlyNumbers && args.onlyNumbers.length > 0) {
                const set = new Set(args.onlyNumbers)
                items = items.filter(item => set.has(item.n))
            }
            if (args.offset !== undefined) {
                items = items.slice(args.offset)
            }
            if (args.limit !== undefined) {
                items = items.slice(0, args.limit)
            }

            const summary = {created: 0, updated: 0, skipped: 0, published: 0, failed: 0}
            const results: any[] = []

            for (const item of items) {
                results.push(await handleItem(item))
            }

            async function handleItem(item: any): Promise<any> {
                const fail = (reason: string): any => {
                    summary.failed++
                    return {n: item.n, slug: item.slug, error: reason}
                }
                try {
                    if (!slugPattern.test(item.slug)) {
                        return fail(`invalid slug: ${item.slug}`)
                    }
                    const accessPolicy = item.accessPolicy === 'PAID' ? 'PAID' : 'FREE'

                    // --- media assets (reuse READY assets by filename) ---
                    let audioAssetId: number | undefined
                    if (item.mp3?.filename && mediaByFilename.get(item.mp3.filename)?.status === 'READY') {
                        audioAssetId = mediaByFilename.get(item.mp3.filename).id
                    } else if (item.mp3) {
                        audioAssetId = await uploadAsset(item.mp3, 'AUDIO')
                        mediaByFilename.set(item.mp3.filename, {id: audioAssetId, status: 'READY'})
                    }

                    let coverAssetId: number | undefined
                    if (item.cover?.filename && mediaByFilename.get(item.cover.filename)?.status === 'READY') {
                        coverAssetId = mediaByFilename.get(item.cover.filename).id
                    } else if (item.cover) {
                        coverAssetId = await uploadAsset(item.cover, 'IMAGE')
                        mediaByFilename.set(item.cover.filename, {id: coverAssetId, status: 'READY'})
                    }

                    // --- episode ---
                    let episode = bySlug.get(item.slug)
                    let mode: 'created' | 'updated' | 'skipped'
                    if (!episode) {
                        episode = unwrap(await api('POST', 'api/v1/episodes', {
                            seriesId: series.id,
                            slug: item.slug,
                            title: item.title,
                            description: item.description,
                            accessPolicy,
                            episodeNumber: item.n,
                            coverAssetId,
                        }))
                        if (episode && !episode.audioAssetId && audioAssetId) {
                            await api('POST', `api/v1/episodes/${episode.id}/audio`, {audioAssetId})
                        }
                        summary.created++
                        mode = 'created'
                    } else {
                        const missing: string[] = []
                        if (!episode.description && item.description) {
                            await api('PUT', `api/v1/episodes/${episode.id}`, {description: item.description})
                            missing.push('description')
                        }
                        if (!episode.audioAssetId && audioAssetId) {
                            await api('POST', `api/v1/episodes/${episode.id}/audio`, {audioAssetId})
                            missing.push('audio')
                        }
                        if (!episode.coverAssetId && coverAssetId) {
                            await api('PUT', `api/v1/episodes/${episode.id}`, {coverAssetId})
                            missing.push('cover')
                        }
                        summary.updated++
                        mode = 'updated'
                    }

                    // --- formats (required before publishing) ---
                    const episodeView = unwrap(await api('GET', `api/v1/episodes/${episode.id}`))
                    const hasFormats = Array.isArray(episodeView?.formats) && episodeView.formats.length > 0
                    if (!hasFormats && args.formatIds && args.formatIds.length > 0) {
                        await api('PUT', `api/v1/episodes/${episode.id}/formats`, {formatIds: args.formatIds})
                    }

                    // --- publication ---
                    const status = unwrap(await api('GET', `api/v1/episodes/${episode.id}`))?.status
                    if (status !== 'PUBLISHED') {
                        const when = item.publishedAt ? new Date(item.publishedAt) : undefined
                        if (when && !Number.isNaN(when.getTime())) {
                            if (when.getTime() > Date.now()) {
                                await api('POST', `api/v1/episodes/${episode.id}/schedule`, {
                                    scheduledAt: item.publishedAt,
                                    notifySubscribers: false,
                                })
                            } else {
                                await api('POST', `api/v1/episodes/${episode.id}/publish`, {
                                    notifySubscribers: false,
                                    publishedAt: item.publishedAt,
                                })
                            }
                        } else {
                            await api('POST', `api/v1/episodes/${episode.id}/publish`, {notifySubscribers: false})
                        }
                        summary.published++
                    } else {
                        summary.skipped++
                    }

                    return {n: item.n, slug: item.slug, episodeId: episode.id, mode}
                } catch (error) {
                    const detail = error instanceof DirectwerkApiError && error.body
                        ? ` ${JSON.stringify(error.body)}`
                        : ''
                    return fail(`${error instanceof Error ? error.message : String(error)}${detail}`)
                }
            }

            return toolResult({seriesId: series.id, summary, results})
        } catch (error) {
            return toolError(error)
        }
    })

    return server
}
