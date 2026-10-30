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
        body: z.string().optional(),
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
        body: z.string().optional(),
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
        notify: z.boolean().optional(),
    }, async ({articleId, notify}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/publish`, notify === undefined ? {} : {notify}))
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

    server.tool('schedule_article', 'Schedule an article publish time', {
        articleId: idSchema,
        publishAt: z.string().min(1),
        notify: z.boolean().optional(),
    }, async ({articleId, ...body}) => {
        try {
            return toolResult(await api('POST', `api/v1/articles/${articleId}/schedule`, body))
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
        description: z.string().optional(),
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
        description: z.string().optional(),
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

    server.tool('publish_episode', 'Publish an episode', {
        episodeId: idSchema,
        notify: z.boolean().optional(),
    }, async ({episodeId, notify}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/publish`, notify === undefined ? {} : {notify}))
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

    server.tool('schedule_episode', 'Schedule an episode publish time', {
        episodeId: idSchema,
        publishAt: z.string().min(1),
        notify: z.boolean().optional(),
    }, async ({episodeId, ...body}) => {
        try {
            return toolResult(await api('POST', `api/v1/episodes/${episodeId}/schedule`, body))
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

    return server
}
