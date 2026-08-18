import type {
    Access,
    AccessLevel,
    ApiEnvelope,
    FeedFormat,
    FeedPreview,
    MediaAsset,
    Me,
    PublicArticle,
    PublicCategory,
    PublicEpisode,
    PublicFormat,
    PublicSeries,
    SiteConfig,
    SubscriberDownload,
    SubscriberFeed,
    SubscriptionSummary,
    TokenResponse,
} from '@/lib/api/types'
} from '@/lib/api/types'
import {isAllowedFeedUrl} from '@/lib/feeds'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedString(value: unknown, maxLength = 255): value is string {
    return typeof value === 'string' && value.length <= maxLength
}

function isNullableString(value: unknown, maxLength = 2048): value is string | null {
    return value === null || isBoundedString(value, maxLength)
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length <= 100 &&
        value.every((item) => isBoundedString(item))
    )
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isPositiveSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value > 0
    )
}

function isSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value)
}

function isValidHttpStatus(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 100 &&
        value <= 599
    )
}

function envelope<T>(
    value: unknown,
    parseData: (data: unknown) => T | null,
): ApiEnvelope<T> | null {
    if (!isRecord(value) || !isValidHttpStatus(value.statusCode)) {
        return null
    }

    const data = parseData(value.data)
    if (data === null) {
        return null
    }

    return {
        statusCode: value.statusCode,
        statusMessage: isBoundedString(value.statusMessage)
            ? value.statusMessage
            : '',
        data,
        errors: [],
        metadata: {},
    }
}

export function parseTokenResponse(value: unknown): TokenResponse | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.access_token, 8192) ||
        value.access_token.length === 0 ||
        /\s/.test(value.access_token)
    ) {
        return null
    }

    if (
        value.refresh_token !== undefined &&
        (!isBoundedString(value.refresh_token, 8192) ||
            value.refresh_token.length === 0 ||
            /\s/.test(value.refresh_token))
    ) {
        return null
    }

    if (
        value.expires_in !== undefined &&
        (typeof value.expires_in !== 'number' ||
            !Number.isFinite(value.expires_in) ||
            value.expires_in < 0)
    ) {
        return null
    }

    return {
        access_token: value.access_token,
        ...(value.refresh_token === undefined
            ? {}
            : {refresh_token: value.refresh_token}),
        ...(value.expires_in === undefined ? {} : {expires_in: value.expires_in}),
    }
}

export function parseSiteConfigEnvelope(
    value: unknown,
): ApiEnvelope<SiteConfig> | null {
    return envelope(value, (data) => {
        if (
            !isRecord(data) ||
            !isRecord(data.tenant) ||
            !isBoundedString(data.tenant.slug) ||
            !isBoundedString(data.tenant.name) ||
            !isStringArray(data.enabledModules) ||
            !isRecord(data.branding) ||
            !isNullableString(data.branding.siteTitle) ||
            !isNullableString(data.branding.primaryColor) ||
            !isNullableString(data.branding.secondaryColor) ||
            !isNullableString(data.branding.logoUrl)
        ) {
            return null
        }

        return {
            tenant: {
                slug: data.tenant.slug,
                name: data.tenant.name,
            },
            enabledModules: data.enabledModules,
            branding: {
                siteTitle: data.branding.siteTitle,
                primaryColor: data.branding.primaryColor,
                secondaryColor: data.branding.secondaryColor,
                logoUrl: data.branding.logoUrl,
            },
            publicRssUrl: isNullableString(data.publicRssUrl) ? data.publicRssUrl : null,
        }
    })
}

export function parseMeEnvelope(value: unknown): ApiEnvelope<Me> | null {
    return envelope(value, (data) => {
        if (
            !isRecord(data) ||
            !isBoundedString(data.email, 254) ||
            !isValidEmail(data.email) ||
            !isNullableString(data.name, 255) ||
            !isStringArray(data.roles) ||
            !isPositiveSafeInteger(data.tenantId)
        ) {
            return null
        }

        return data as unknown as Me
    })
}

function parseAccessLevel(value: unknown): AccessLevel | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isSafeInteger(value.sortOrder)
    ) {
        return null
    }

    return value as unknown as AccessLevel
}

export function parseAccessEnvelope(value: unknown): ApiEnvelope<Access> | null {
    return envelope(value, (data) => {
        if (
            !isRecord(data) ||
            !Array.isArray(data.activeLevels) ||
            data.activeLevels.length > 100 ||
            data.activeLevels.some((level) => parseAccessLevel(level) === null) ||
            (data.maxLevelSortOrder !== null &&
                !isSafeInteger(data.maxLevelSortOrder)) ||
            !isStringArray(data.roles) ||
            !isPositiveSafeInteger(data.tenantId)
        ) {
            return null
        }

        return data as unknown as Access
    })
}

function isNullableSafeInteger(value: unknown): value is number | null {
    return value === null || isSafeInteger(value)
}

function isNullableNonNegativeSafeInteger(value: unknown): value is number | null {
    return value === null || (isSafeInteger(value) && value >= 0)
}

function parseMediaAsset(value: unknown): MediaAsset | null {
    if (!isRecord(value)) {
        return null
    }

    const cdnUrl = value.cdnUrl === undefined ? null : value.cdnUrl

    if (
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.s3Key, 512) ||
        !isBoundedString(value.visibility, 64) ||
        !isBoundedString(value.scope, 64) ||
        !isBoundedString(value.assetType, 64) ||
        !isBoundedString(value.status, 64) ||
        !isNullableString(value.mimeType, 255) ||
        !isNullableNonNegativeSafeInteger(value.sizeBytes) ||
        !isNullableString(value.originalFilename, 512) ||
        !isNullableSafeInteger(value.episodeId) ||
        !isNullableSafeInteger(value.ownerUserId) ||
        !isNullableString(cdnUrl, 2048) ||
        !isBoundedString(value.createdAt, 64) ||
        !isBoundedString(value.updatedAt, 64)
    ) {
        return null
    }

    return {
        ...(value as unknown as MediaAsset),
        cdnUrl,
    }
}

export function parseMediaListEnvelope(
    value: unknown,
): ApiEnvelope<MediaAsset[]> | null {
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 100) {
            return null
        }

        const parsed: MediaAsset[] = []
        for (const item of data) {
            const asset = parseMediaAsset(item)
            if (asset === null) {
                return null
            }
            parsed.push(asset)
        }

        return parsed
    })
}

export function parsePreviewUrlEnvelope(value: unknown): string | null {
    if (!isRecord(value) || !isRecord(value.data)) {
        return null
    }
    const url = value.data.url
    if (!isBoundedString(url, 2048) || url.length === 0) {
        return null
    }
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'https:') {
            return null
        }
    } catch {
        return null
    }
    return url
}

function parsePublicCategory(value: unknown): PublicCategory | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name) ||
        !(value.parentId === null || isPositiveSafeInteger(value.parentId))
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        name: value.name,
        parentId: value.parentId,
    }
}

function parseAccessPolicy(value: unknown): 'FREE' | 'PAID' | null {
    return value === 'FREE' || value === 'PAID' ? value : null
}

function parsePublicArticle(value: unknown): PublicArticle | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isNullableString(value.body, 512_000) ||
        !isNullableString(value.excerpt, 4096) ||
        !isNullableString(value.seoDescription, 512) ||
        !(
            value.heroAssetId === null ||
            value.heroAssetId === undefined ||
            isPositiveSafeInteger(value.heroAssetId)
        ) ||
        parseAccessPolicy(value.accessPolicy) === null ||
        !isNullableNonNegativeSafeInteger(value.requiredLevelSortOrder) ||
        !isNullableString(value.publishedAt, 64) ||
        !Array.isArray(value.categories) ||
        value.categories.length > 100
    ) {
        return null
    }

    const categories: PublicCategory[] = []
    for (const item of value.categories) {
        const category = parsePublicCategory(item)
        if (category === null) {
            return null
        }
        categories.push(category)
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        body: value.body === null ? null : sanitizeContentHtml(value.body),
        excerpt: value.excerpt,
        seoDescription: value.seoDescription,
        heroAssetId:
            value.heroAssetId === undefined || value.heroAssetId === null
                ? null
                : value.heroAssetId,
        accessPolicy: value.accessPolicy as 'FREE' | 'PAID',
        requiredLevelSortOrder: value.requiredLevelSortOrder,
        publishedAt: value.publishedAt,
        categories,
    }
}

function parseBoundedArray<T>(
    data: unknown,
    maxLength: number,
    parseItem: (item: unknown) => T | null,
): T[] | null {
    if (!Array.isArray(data) || data.length > maxLength) {
        return null
    }

    const parsed: T[] = []
    for (const item of data) {
        const value = parseItem(item)
        if (value === null) {
            return null
        }
        parsed.push(value)
    }

    return parsed
}

export function parsePublicArticleListEnvelope(
    value: unknown,
): ApiEnvelope<PublicArticle[]> | null {
    return envelope(value, (data) =>
        parseBoundedArray(data, 500, parsePublicArticle),
    )
}

export function parsePublicArticleEnvelope(
    value: unknown,
): ApiEnvelope<PublicArticle> | null {
    return envelope(value, parsePublicArticle)
}

function parsePublicSeries(value: unknown): PublicSeries | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isNullableString(value.description, 512_000) ||
        !(
            value.coverAssetId === null ||
            value.coverAssetId === undefined ||
            isPositiveSafeInteger(value.coverAssetId)
        ) ||
        !isNullableString(value.language, 16) ||
        !isNullableString(value.itunesCategory, 128)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        description: value.description,
        coverAssetId:
            value.coverAssetId === undefined || value.coverAssetId === null
                ? null
                : value.coverAssetId,
        language: value.language,
        itunesCategory: value.itunesCategory,
    }
}

export function parsePublicSeriesListEnvelope(
    value: unknown,
): ApiEnvelope<PublicSeries[]> | null {
    return envelope(value, (data) =>
        parseBoundedArray(data, 100, parsePublicSeries),
    )
}

function parsePublicEpisode(value: unknown): PublicEpisode | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.seriesId) ||
        !isBoundedString(value.seriesSlug) ||
        !(
            value.episodeNumber === null ||
            value.episodeNumber === undefined ||
            (isSafeInteger(value.episodeNumber) && value.episodeNumber >= 1)
        ) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isNullableString(value.description, 512_000) ||
        !(
            value.durationSeconds === null ||
            value.durationSeconds === undefined ||
            (isSafeInteger(value.durationSeconds) && value.durationSeconds >= 1)
        ) ||
        parseAccessPolicy(value.accessPolicy) === null ||
        !isNullableNonNegativeSafeInteger(value.requiredLevelSortOrder) ||
        !isNullableString(value.publishedAt, 64) ||
        !isNullableString(value.audioCdnUrl, 4096)
    ) {
        return null
    }

    return {
        id: value.id,
        seriesId: value.seriesId,
        seriesSlug: value.seriesSlug,
        episodeNumber:
            value.episodeNumber === undefined || value.episodeNumber === null
                ? null
                : value.episodeNumber,
        slug: value.slug,
        title: value.title,
        description:
            value.description === null
                ? null
                : sanitizeContentHtml(value.description),
        durationSeconds:
            value.durationSeconds === undefined || value.durationSeconds === null
                ? null
                : value.durationSeconds,
        accessPolicy: value.accessPolicy as 'FREE' | 'PAID',
        requiredLevelSortOrder: value.requiredLevelSortOrder,
        publishedAt: value.publishedAt,
        audioCdnUrl: value.audioCdnUrl,
    }
}

export function parsePublicEpisodeListEnvelope(
    value: unknown,
): ApiEnvelope<PublicEpisode[]> | null {
    return envelope(value, (data) =>
        parseBoundedArray(data, 500, parsePublicEpisode),
    )
}

function parseFeedFormat(value: unknown): FeedFormat | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name) ||
        !isNullableNonNegativeSafeInteger(value.requiredLevelSortOrder) ||
        !isSafeInteger(value.sortOrder)
    ) {
        return null
    }
    return {
        id: value.id,
        slug: value.slug,
        name: value.name,
        requiredLevelSortOrder: value.requiredLevelSortOrder,
        sortOrder: value.sortOrder,
    }
}

function parsePublicFormat(value: unknown): PublicFormat | null {
    const base = parseFeedFormat(value)
    if (base === null || !isRecord(value) || !isNullableString(value.description, 4000)) {
        return null
    }
    return {
        ...base,
        description: value.description,
    }
}

export function parsePublicFormatListEnvelope(
    value: unknown,
): ApiEnvelope<PublicFormat[]> | null {
    return envelope(value, (data) => parseBoundedArray(data, 100, parsePublicFormat))
}

function parseSubscriberFeed(value: unknown): SubscriberFeed | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.title) ||
        typeof value.isDefault !== 'boolean' ||
        typeof value.enabled !== 'boolean' ||
        !isBoundedString(value.url, 4096) ||
        !isAllowedFeedUrl(value.url) ||
        !isBoundedString(value.createdAt, 64) ||
        !isBoundedString(value.updatedAt, 64)
    ) {
        return null
    }

    const formatIds =
        value.formatIds === undefined
            ? []
            : parseBoundedArray(value.formatIds, 50, (item) =>
                  isPositiveSafeInteger(item) ? item : null,
              )
    const formats =
        value.formats === undefined
            ? []
            : parseBoundedArray(value.formats, 50, parseFeedFormat)
    if (formatIds === null || formats === null) {
        return null
    }

    return {
        id: value.id,
        title: value.title,
        isDefault: value.isDefault,
        enabled: value.enabled,
        url: value.url,
        formatIds,
        formats,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    }
}

function parseFeedPreview(value: unknown): FeedPreview | null {
    if (
        !isRecord(value) ||
        !isSafeInteger(value.episodeCount) ||
        value.episodeCount < 0 ||
        !Array.isArray(value.sampleTitles)
    ) {
        return null
    }
    const sampleTitles = parseBoundedArray(value.sampleTitles, 10, (item) =>
        isBoundedString(item, 255) ? item : null,
    )
    if (sampleTitles === null) {
        return null
    }
    return {episodeCount: value.episodeCount, sampleTitles}
}

export function parseFeedPreviewEnvelope(
    value: unknown,
): ApiEnvelope<FeedPreview> | null {
    return envelope(value, parseFeedPreview)
}

export function parseSubscriberFeedListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeed[]> | null {
    return envelope(value, (data) =>
        parseBoundedArray(data, 50, parseSubscriberFeed),
    )
}

function parseSubscriberDownload(value: unknown): SubscriberDownload | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.title) ||
        !isBoundedString(value.assetType, 64) ||
        !isNullableString(value.mimeType, 128) ||
        (value.sizeBytes != null &&
            !(typeof value.sizeBytes === 'number' && Number.isSafeInteger(value.sizeBytes) && value.sizeBytes >= 0)) ||
        !isBoundedString(value.downloadUrl, 4096) ||
        !isAllowedFeedUrl(value.downloadUrl)
    ) {
        return null
    }

    return {
        id: value.id,
        title: value.title,
        assetType: value.assetType,
        mimeType: value.mimeType,
        sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : null,
        downloadUrl: value.downloadUrl,
    }
}

export function parseSubscriberDownloadListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberDownload[]> | null {
    return envelope(value, (data) => parseBoundedArray(data, 50, parseSubscriberDownload))
}

export function parseCheckoutSessionEnvelope(value: unknown): string | null {
    if (!isRecord(value) || !isRecord(value.data)) {
        return null
    }
    const url = value.data.url
    if (!isBoundedString(url, 4096) || !isAllowedFeedUrl(url)) {
        return null
    }
    return url
}

function parseSubscriptionSummary(value: unknown): SubscriptionSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.productId) ||
        !isBoundedString(value.productSlug) ||
        !isBoundedString(value.productTitle) ||
        !isBoundedString(value.offeringType, 64) ||
        !isBoundedString(value.status, 64) ||
        !isBoundedString(value.source, 64) ||
        !isNullableString(value.startedAt, 64) ||
        !isNullableString(value.endsAt, 64)
    ) {
        return null
    }

    return {
        id: value.id,
        productId: value.productId,
        productSlug: value.productSlug,
        productTitle: value.productTitle,
        offeringType: value.offeringType,
        status: value.status,
        source: value.source,
        startedAt: value.startedAt,
        endsAt: value.endsAt,
    }
}

export function parseSubscriptionListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriptionSummary[]> | null {
    return envelope(value, (data) =>
        parseBoundedArray(data, 200, parseSubscriptionSummary),
    )
}

export function parseSubscriberFeedEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeed> | null {
    return envelope(value, parseSubscriberFeed)
}
