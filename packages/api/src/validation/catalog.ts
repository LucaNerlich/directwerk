import type {
    AccessPolicy,
    ApiEnvelope,
    ArticleDetail,
    ArticleFeedAdminView,
    ArticleSummary,
    BillingDashboard,
    BillingInterval,
    BillingMembership,
    BillingStats,
    CategorySummary,
    CategoryTag,
    ContentEmailTemplate,
    ContentEmailTemplateType,
    DomainVerificationChallenge,
    EpisodeDetail,
    EpisodeSummary,
    ImportedEpisodeResult,
    RssImportPreview,
    FormatSummary,
    FormatTag,
    InviteTenantUserResponse,
    LevelSummary,
    Me,
    MediaAsset,
    MembershipStatus,
    OfferingType,
    ProductAccessRule,
    ProductAccessScopeType,
    PublicationStatus,
    PublicCategory,
    SeriesDetail,
    SeriesStatus,
    SeriesSummary,
    SiteConfig,
    StudioWorkspace,
    StripeStatus,
    SubscriberFeedAdminView,
    SubscriptionGrant,
    SubscriptionProduct,
    Tag,
    TenantBranding,
    TenantDomain,
    TenantSubscriber,
    TenantSubscriberSubscription,
    TenantUser,
    UploadUrlResponse,
} from '../types'
import {
    isBoundedString,
    isNonNegativeSafeInteger,
    isNullableString,
    isPositiveSafeInteger,
    isRecord,
    isSafeInteger,
    isStringArray,
    isValidEmail,
    isValidHttpStatus,
    parseBoundedArray,
    parseEnvelope,
} from './primitives'
import {parseSiteAnalytics} from './public'

// ---------------------------------------------------------------------------
// Shared entity parsers
// ---------------------------------------------------------------------------

export function parseMeEnvelope(value: unknown): ApiEnvelope<Me> | null {
    return parseEnvelope(value, (data) => {
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

        return {
            email: data.email,
            name: data.name,
            roles: data.roles,
            tenantId: data.tenantId,
        }
    })
}

export function parseStudioWorkspacesEnvelope(
    value: unknown,
): ApiEnvelope<{workspaces: StudioWorkspace[]}> | null {
    return parseEnvelope(value, (data) => {
        if (!isRecord(data) || !Array.isArray(data.workspaces)) {
            return null
        }

        const workspaces: StudioWorkspace[] = []
        for (const item of data.workspaces) {
            if (
                !isRecord(item) ||
                !isPositiveSafeInteger(item.tenantId) ||
                !isBoundedString(item.slug, 128) ||
                !isBoundedString(item.name, 255) ||
                !isBoundedString(item.host, 253)
            ) {
                return null
            }
            workspaces.push({
                tenantId: item.tenantId,
                slug: item.slug,
                name: item.name,
                host: item.host,
            })
        }

        return {workspaces}
    })
}

function parseAccessPolicy(value: unknown): value is AccessPolicy {
    return value === 'FREE' || value === 'PAID'
}

function isPublicationStatus(value: unknown): value is PublicationStatus {
    return (
        value === 'DRAFT' ||
        value === 'SCHEDULED' ||
        value === 'PUBLISHED' ||
        value === 'ARCHIVED'
    )
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

function parseArticleSummary(value: unknown): ArticleSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isPublicationStatus(value.status) ||
        !parseAccessPolicy(value.accessPolicy)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        status: value.status,
        accessPolicy: value.accessPolicy,
        publishedAt: isNullableString(value.publishedAt, 64) ? value.publishedAt : null,
    }
}

function parseTag(value: unknown): Tag | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name)
    ) {
        return null
    }

    return {id: value.id, slug: value.slug, name: value.name}
}

function parseTagArray(value: unknown): Tag[] | null {
    if (!Array.isArray(value) || value.length > 100) {
        return null
    }

    const parsed: Tag[] = []
    for (const item of value) {
        const tag = parseTag(item)
        if (tag === null) {
            return null
        }
        parsed.push(tag)
    }

    return parsed
}

function parseArticleDetail(value: unknown): ArticleDetail | null {
    const summary = parseArticleSummary(value)
    if (summary === null || !isRecord(value)) {
        return null
    }

    const categories = parseTagArray(value.categories)
    if (categories === null) {
        return null
    }

    return {
        ...summary,
        categories,
        body: isNullableString(value.body, 512_000) ? value.body : null,
        excerpt: isNullableString(value.excerpt, 4096) ? value.excerpt : null,
        seoDescription: isNullableString(value.seoDescription, 512)
            ? value.seoDescription
            : null,
        heroAssetId:
            value.heroAssetId === null || value.heroAssetId === undefined
                ? null
                : isPositiveSafeInteger(value.heroAssetId)
                  ? value.heroAssetId
                  : null,
        requiredLevelSortOrder:
            value.requiredLevelSortOrder === null ||
            value.requiredLevelSortOrder === undefined
                ? null
                : isSafeInteger(value.requiredLevelSortOrder) &&
                    value.requiredLevelSortOrder >= 0
                  ? value.requiredLevelSortOrder
                  : null,
        scheduledAt: isNullableString(value.scheduledAt, 64) ? value.scheduledAt : null,
    }
}

export function parseArticleListEnvelope(
    value: unknown,
): ApiEnvelope<ArticleDetail[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parseArticleDetail),
    )
}

export function parseArticleEnvelope(
    value: unknown,
): ApiEnvelope<ArticleDetail> | null {
    return parseEnvelope(value, parseArticleDetail)
}

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

function parseEpisodeSummary(value: unknown): EpisodeSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isPublicationStatus(value.status) ||
        !parseAccessPolicy(value.accessPolicy)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        status: value.status,
        accessPolicy: value.accessPolicy,
        publishedAt: isNullableString(value.publishedAt, 64) ? value.publishedAt : null,
    }
}

function parseEpisodeDetail(value: unknown): EpisodeDetail | null {
    const summary = parseEpisodeSummary(value)
    if (summary === null || !isRecord(value)) {
        return null
    }

    if (!isPositiveSafeInteger(value.seriesId)) {
        return null
    }

    const formats = parseTagArray(value.formats)
    const categories = parseTagArray(value.categories)
    if (formats === null || categories === null) {
        return null
    }

    return {
        ...summary,
        formats,
        categories,
        description: isNullableString(value.description, 512_000)
            ? value.description
            : null,
        episodeNumber:
            value.episodeNumber === null || value.episodeNumber === undefined
                ? null
                : isSafeInteger(value.episodeNumber) && value.episodeNumber >= 1
                  ? value.episodeNumber
                  : null,
        seriesId: value.seriesId,
        seriesSlug: isBoundedString(value.seriesSlug) ? value.seriesSlug : null,
        audioAssetId:
            value.audioAssetId === null || value.audioAssetId === undefined
                ? null
                : isPositiveSafeInteger(value.audioAssetId)
                  ? value.audioAssetId
                  : null,
        coverAssetId:
            value.coverAssetId === null || value.coverAssetId === undefined
                ? null
                : isPositiveSafeInteger(value.coverAssetId)
                  ? value.coverAssetId
                  : null,
        enclosureEnabled: value.enclosureEnabled === false ? false : true,
        requiredLevelSortOrder:
            value.requiredLevelSortOrder === null ||
            value.requiredLevelSortOrder === undefined
                ? null
                : isSafeInteger(value.requiredLevelSortOrder) &&
                    value.requiredLevelSortOrder >= 0
                  ? value.requiredLevelSortOrder
                  : null,
        scheduledAt: isNullableString(value.scheduledAt, 64) ? value.scheduledAt : null,
    }
}

export function parseEpisodeListEnvelope(
    value: unknown,
): ApiEnvelope<EpisodeDetail[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parseEpisodeDetail),
    )
}

export function parseEpisodeEnvelope(
    value: unknown,
): ApiEnvelope<EpisodeDetail> | null {
    return parseEnvelope(value, parseEpisodeDetail)
}

/**
 * Parses an RSS import channel into a validated channel object.
 *
 * @param value - The value to validate and parse
 * @returns The parsed RSS import channel, or `null` for an invalid value
 */
function parseRssImportChannel(value: unknown): RssImportPreview['channel'] | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.title, 512) ||
        !isNullableString(value.description, 20000) ||
        !isNullableString(value.language, 8) ||
        !isNullableString(value.itunesCategory, 128) ||
        !isNullableString(value.imageUrl, 2048) ||
        !isNullableString(value.link, 2048) ||
        !isBoundedString(value.suggestedSlug, 64)
    ) {
        return null
    }
    return {
        title: value.title,
        description: value.description,
        language: value.language,
        itunesCategory: value.itunesCategory,
        imageUrl: value.imageUrl,
        link: value.link,
        suggestedSlug: value.suggestedSlug,
    }
}

/**
 * Parses an RSS episode preview into a validated episode record.
 *
 * @param value - The value to validate and parse
 * @returns The parsed episode preview, or `null` when the value is invalid
 */
function parseRssImportEpisodePreview(
    value: unknown,
): RssImportPreview['episodes'][number] | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.guid, 512) ||
        !isBoundedString(value.title, 512) ||
        !isNullableString(value.description, 512_000) ||
        !isNullableString(value.publishedAt, 64) ||
        !isNullableString(value.audioUrl, 2048) ||
        !isNullableString(value.audioMimeType, 128) ||
        !isNullableString(value.imageUrl, 2048) ||
        !isBoundedString(value.suggestedSlug, 64) ||
        (value.durationSeconds != null &&
            (!isSafeInteger(value.durationSeconds) || value.durationSeconds < 1)) ||
        (value.episodeNumber != null &&
            (!isSafeInteger(value.episodeNumber) || value.episodeNumber < 1)) ||
        (value.audioSizeBytes != null &&
            (!isSafeInteger(value.audioSizeBytes) || value.audioSizeBytes < 1)) ||
        (value.alreadyImportedEpisodeId != null &&
            !isPositiveSafeInteger(value.alreadyImportedEpisodeId))
    ) {
        return null
    }
    return {
        guid: value.guid,
        title: value.title,
        description: value.description,
        publishedAt: value.publishedAt,
        durationSeconds: value.durationSeconds ?? null,
        episodeNumber: value.episodeNumber ?? null,
        audioUrl: value.audioUrl,
        audioMimeType: value.audioMimeType,
        audioSizeBytes: value.audioSizeBytes ?? null,
        imageUrl: value.imageUrl,
        suggestedSlug: value.suggestedSlug,
        alreadyImportedEpisodeId: value.alreadyImportedEpisodeId ?? null,
    }
}

/**
 * Parses an RSS import preview into a validated domain object.
 *
 * @param value - The value to validate and parse
 * @returns The parsed RSS import preview, or `null` for an invalid value
 */
function parseRssImportPreview(value: unknown): RssImportPreview | null {
    if (!isRecord(value) || !isBoundedString(value.feedUrl, 2048)) {
        return null
    }
    const channel = parseRssImportChannel(value.channel)
    // The feed document itself is bounded by the API, so keep every parsed item
    // instead of silently dropping a creator's back catalog.
    const episodes = parseBoundedArray(value.episodes, 50_000, parseRssImportEpisodePreview)
    if (channel === null || episodes === null || typeof value.truncated !== 'boolean') {
        return null
    }
    return {
        feedUrl: value.feedUrl,
        channel,
        episodes,
        truncated: value.truncated,
    }
}

/**
 * Parses an API response envelope containing an RSS import preview.
 *
 * @param value - The value to validate and parse
 * @returns The parsed RSS import preview envelope, or `null` for an invalid value
 */
export function parseRssImportPreviewEnvelope(
    value: unknown,
): ApiEnvelope<RssImportPreview> | null {
    return parseEnvelope(value, parseRssImportPreview)
}

/**
 * Parses an imported episode result.
 *
 * @param value - The value to validate and parse
 * @returns The imported episode result, or `null` if the value is invalid
 */
function parseImportedEpisodeResult(value: unknown): ImportedEpisodeResult | null {
    if (!isRecord(value) || typeof value.alreadyImported !== 'boolean') {
        return null
    }
    const episode = parseEpisodeDetail(value.episode)
    if (episode === null) {
        return null
    }
    return {episode, alreadyImported: value.alreadyImported}
}

/**
 * Parses an API envelope containing an imported episode result.
 *
 * @param value - The value to validate and parse
 * @returns The parsed API envelope, or `null` if the value is invalid
 */
export function parseImportedEpisodeEnvelope(
    value: unknown,
): ApiEnvelope<ImportedEpisodeResult> | null {
    return parseEnvelope(value, parseImportedEpisodeResult)
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

function isSeriesStatus(value: unknown): value is SeriesStatus {
    return value === 'DRAFT' || value === 'PUBLISHED'
}

function parseSeriesSummary(value: unknown): SeriesSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isSeriesStatus(value.status) ||
        !isNullableString(value.rssUrl, 2048)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        status: value.status,
        rssUrl: value.rssUrl,
    }
}

function parseSeriesDetail(value: unknown): SeriesDetail | null {
    const summary = parseSeriesSummary(value)
    if (summary === null || !isRecord(value)) {
        return null
    }
    if (
        !isNullableString(value.description, 20000) ||
        !(value.coverAssetId === null || isPositiveSafeInteger(value.coverAssetId)) ||
        !isNullableString(value.language, 8) ||
        !isNullableString(value.itunesCategory, 128) ||
        typeof value.itunesExplicit !== 'boolean' ||
        !(
            value.defaultRequiredLevelSortOrder === null ||
            (typeof value.defaultRequiredLevelSortOrder === 'number' &&
                Number.isSafeInteger(value.defaultRequiredLevelSortOrder) &&
                value.defaultRequiredLevelSortOrder >= 0)
        ) ||
        !isNullableString(value.rssUrl, 2048)
    ) {
        return null
    }

    return {
        ...summary,
        description: value.description,
        coverAssetId: value.coverAssetId,
        language: value.language,
        itunesCategory: value.itunesCategory,
        itunesExplicit: value.itunesExplicit,
        defaultRequiredLevelSortOrder: value.defaultRequiredLevelSortOrder,
        rssUrl: value.rssUrl,
    }
}

export function parseSeriesListEnvelope(
    value: unknown,
): ApiEnvelope<SeriesSummary[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 100, parseSeriesSummary),
    )
}

export function parseSeriesEnvelope(
    value: unknown,
): ApiEnvelope<SeriesDetail> | null {
    return parseEnvelope(value, parseSeriesDetail)
}

// ---------------------------------------------------------------------------
// Media assets — full backend MediaAssetView projection
// ---------------------------------------------------------------------------

export function parseMediaAsset(value: unknown): MediaAsset | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.status) ||
        !isBoundedString(value.assetType) ||
        !isBoundedString(value.s3Key) ||
        !isBoundedString(value.visibility) ||
        !isBoundedString(value.scope) ||
        !isBoundedString(value.createdAt, 64) ||
        !isBoundedString(value.updatedAt, 64) ||
        !(value.episodeId === null || isPositiveSafeInteger(value.episodeId)) ||
        !(value.ownerUserId === null || isPositiveSafeInteger(value.ownerUserId))
    ) {
        return null
    }

    return {
        id: value.id,
        s3Key: value.s3Key,
        visibility: value.visibility,
        scope: value.scope,
        assetType: value.assetType,
        status: value.status,
        mimeType: isNullableString(value.mimeType, 128) ? value.mimeType : null,
        originalFilename: isNullableString(value.originalFilename, 255)
            ? value.originalFilename
            : null,
        sizeBytes:
            value.sizeBytes === null || value.sizeBytes === undefined
                ? null
                : isPositiveSafeInteger(value.sizeBytes)
                  ? value.sizeBytes
                  : null,
        bytesTransferred:
            value.bytesTransferred === null || value.bytesTransferred === undefined
                ? 0
                : isNonNegativeSafeInteger(value.bytesTransferred)
                  ? value.bytesTransferred
                  : 0,
        episodeId: value.episodeId ?? null,
        ownerUserId: value.ownerUserId ?? null,
        cdnUrl: isNullableString(value.cdnUrl, 4096) ? value.cdnUrl : null,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    }
}

function parseStringRecord(value: unknown): Record<string, string> | null {
    if (!isRecord(value)) {
        return null
    }

    const result: Record<string, string> = {}
    for (const [key, entry] of Object.entries(value)) {
        if (typeof entry !== 'string') {
            return null
        }
        result[key] = entry
    }

    return result
}

export function parseUploadUrlResponse(value: unknown): UploadUrlResponse | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.assetId) ||
        !isBoundedString(value.uploadUrl, 4096)
    ) {
        return null
    }

    const headers =
        value.headers === undefined || value.headers === null
            ? null
            : parseStringRecord(value.headers)
    if (value.headers !== undefined && value.headers !== null && headers === null) {
        return null
    }

    return {
        assetId: value.assetId,
        uploadUrl: value.uploadUrl,
        expiresAt: isNullableString(value.expiresAt, 64) ? value.expiresAt : null,
        headers,
    }
}

export function parseMediaAssetEnvelope(
    value: unknown,
): ApiEnvelope<MediaAsset> | null {
    return parseEnvelope(value, parseMediaAsset)
}

export function parseMediaListEnvelope(
    value: unknown,
): ApiEnvelope<MediaAsset[]> | null {
    return parseEnvelope(value, (data) => parseBoundedArray(data, 100, parseMediaAsset))
}

/** Validates a signed preview/onboarding URL (https only). */
function parseHttpsDataUrl(value: unknown): string | null {
    if (!isRecord(value) || !isRecord(value.data)) {
        return null
    }
    const url = value.data.url
    if (!isBoundedString(url, 4096) || url.length === 0) {
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

export function parsePreviewUrlEnvelope(value: unknown): string | null {
    return parseHttpsDataUrl(value)
}

export function parseStripeOnboardEnvelope(value: unknown): string | null {
    return parseHttpsDataUrl(value)
}

// ---------------------------------------------------------------------------
// Subscription products / levels / rules / grants
// ---------------------------------------------------------------------------

function isOfferingType(value: unknown): value is OfferingType {
    return value === 'LEVEL' || value === 'PACKAGE'
}

function isBillingInterval(value: unknown): value is BillingInterval {
    return value === 'MONTH' || value === 'YEAR' || value === 'ONE_TIME'
}

function isProductAccessScopeType(value: unknown): value is ProductAccessScopeType {
    return (
        value === 'ALL_PODCASTS' ||
        value === 'PODCAST_SERIES' ||
        value === 'FORMAT' ||
        value === 'CATEGORY' ||
        value === 'DIGITAL_ASSET' ||
        value === 'FEED_BUILDER'
    )
}

function parseSubscriptionProduct(value: unknown): SubscriptionProduct | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isOfferingType(value.offeringType) ||
        !isNonNegativeSafeInteger(value.sortOrder) ||
        typeof value.active !== 'boolean' ||
        !isNullableString(value.description, 2000) ||
        !(value.priceCents === null || isNonNegativeSafeInteger(value.priceCents)) ||
        !isBoundedString(value.currency, 3) ||
        !isBillingInterval(value.billingInterval) ||
        !isNullableString(value.stripeProductId, 64) ||
        !isNullableString(value.stripePriceId, 64)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        offeringType: value.offeringType,
        sortOrder: value.sortOrder,
        active: value.active,
        description: value.description,
        priceCents: value.priceCents,
        currency: value.currency,
        billingInterval: value.billingInterval,
        stripeProductId: value.stripeProductId,
        stripePriceId: value.stripePriceId,
    }
}

export function parseProductListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriptionProduct[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parseSubscriptionProduct),
    )
}

/** Validates an unwrapped tenant product array (post-envelope). */
export function parseSubscriptionProductList(
    value: unknown,
): SubscriptionProduct[] | null {
    return parseBoundedArray(value, 500, parseSubscriptionProduct)
}

export function parseProductEnvelope(
    value: unknown,
): ApiEnvelope<SubscriptionProduct> | null {
    return parseEnvelope(value, parseSubscriptionProduct)
}

function parseLevelSummary(value: unknown): LevelSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isNonNegativeSafeInteger(value.sortOrder)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
        sortOrder: value.sortOrder,
    }
}

export function parseLevelListEnvelope(
    value: unknown,
): ApiEnvelope<LevelSummary[]> | null {
    return parseEnvelope(value, (data) => parseBoundedArray(data, 500, parseLevelSummary))
}

function parseProductAccessRule(value: unknown): ProductAccessRule | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.productId) ||
        !isProductAccessScopeType(value.scopeType) ||
        !(value.scopeId === null || isPositiveSafeInteger(value.scopeId)) ||
        !isBoundedString(value.effect) ||
        !isBoundedString(value.createdAt, 64)
    ) {
        return null
    }

    return {
        id: value.id,
        productId: value.productId,
        scopeType: value.scopeType,
        scopeId: value.scopeId,
        effect: value.effect,
        createdAt: value.createdAt,
    }
}

export function parseProductRuleListEnvelope(
    value: unknown,
): ApiEnvelope<ProductAccessRule[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parseProductAccessRule),
    )
}

function parseSubscriptionGrant(value: unknown): SubscriptionGrant | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.userId) ||
        !isBoundedString(value.email) ||
        !isValidEmail(value.email) ||
        !isPositiveSafeInteger(value.productId) ||
        !isBoundedString(value.productSlug) ||
        !isBoundedString(value.productTitle) ||
        !isBoundedString(value.status) ||
        !isBoundedString(value.source)
    ) {
        return null
    }

    return {
        id: value.id,
        userId: value.userId,
        email: value.email,
        productId: value.productId,
        productSlug: value.productSlug,
        productTitle: value.productTitle,
        status: value.status,
        source: value.source,
    }
}

export function parseSubscriptionGrantEnvelope(
    value: unknown,
): ApiEnvelope<SubscriptionGrant> | null {
    return parseEnvelope(value, parseSubscriptionGrant)
}

// ---------------------------------------------------------------------------
// Formats / categories
// ---------------------------------------------------------------------------

function parseFormatSummary(value: unknown): FormatSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name) ||
        typeof value.active !== 'boolean' ||
        !isNullableString(value.description, 20000) ||
        !(
            value.requiredLevelSortOrder === null ||
            value.requiredLevelSortOrder === undefined ||
            (isSafeInteger(value.requiredLevelSortOrder) &&
                value.requiredLevelSortOrder >= 0)
        ) ||
        !isNonNegativeSafeInteger(value.sortOrder) ||
        !(
            value.coverAssetId === null ||
            value.coverAssetId === undefined ||
            isPositiveSafeInteger(value.coverAssetId)
        )
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        name: value.name,
        active: value.active,
        description: value.description,
        requiredLevelSortOrder:
            value.requiredLevelSortOrder === null ||
            value.requiredLevelSortOrder === undefined
                ? null
                : value.requiredLevelSortOrder,
        sortOrder: value.sortOrder,
        coverAssetId:
            value.coverAssetId === null || value.coverAssetId === undefined
                ? null
                : value.coverAssetId,
    }
}

export function parseFormatListEnvelope(
    value: unknown,
): ApiEnvelope<FormatSummary[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parseFormatSummary),
    )
}

export function parseFormatEnvelope(
    value: unknown,
): ApiEnvelope<FormatSummary> | null {
    return parseEnvelope(value, parseFormatSummary)
}

function parseCategorySummary(value: unknown): CategorySummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.name) ||
        !(value.parentId === null || isPositiveSafeInteger(value.parentId)) ||
        typeof value.active !== 'boolean'
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        name: value.name,
        parentId: value.parentId,
        active: value.active,
    }
}

export function parseCategoryListEnvelope(
    value: unknown,
): ApiEnvelope<CategorySummary[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parseCategorySummary),
    )
}

export function parseCategoryEnvelope(
    value: unknown,
): ApiEnvelope<CategorySummary> | null {
    return parseEnvelope(value, parseCategorySummary)
}

// ---------------------------------------------------------------------------
// Site configuration (studio shape — requires the studio desk config)
// ---------------------------------------------------------------------------

type StudioDesks = SiteConfig['studioDesks']
type StudioHomeValue = SiteConfig['studioHome']

function parseStudioDesks(value: unknown): StudioDesks | null {
    if (!Array.isArray(value) || value.length > 2) {
        return null
    }

    const desks: StudioDesks = []
    for (const item of value) {
        if (item === 'WRITE' || item === 'PODCAST') {
            desks.push(item)
        } else {
            return null
        }
    }

    return desks
}

function parseStudioHome(value: unknown): StudioHomeValue | null {
    if (value === 'OVERVIEW' || value === 'WRITE_DESK' || value === 'PODCAST_DESK') {
        return value
    }

    return null
}

interface BrandingShape {
    siteTitle: string | null
    primaryColor: string | null
    secondaryColor: string | null
    logoUrl: string | null
}

function parseBranding(data: Record<string, unknown>): BrandingShape | null {
    if (
        !isRecord(data.branding) ||
        !isNullableString(data.branding.siteTitle) ||
        !isNullableString(data.branding.primaryColor) ||
        !isNullableString(data.branding.secondaryColor) ||
        !isNullableString(data.branding.logoUrl)
    ) {
        return null
    }

    return {
        siteTitle: data.branding.siteTitle,
        primaryColor: data.branding.primaryColor,
        secondaryColor: data.branding.secondaryColor,
        logoUrl: data.branding.logoUrl,
    }
}

interface TenantShape {
    slug: string
    name: string
}

function parseTenantInfo(data: Record<string, unknown>): TenantShape | null {
    if (
        !isRecord(data.tenant) ||
        !isBoundedString(data.tenant.slug) ||
        !isBoundedString(data.tenant.name)
    ) {
        return null
    }

    return {slug: data.tenant.slug, name: data.tenant.name}
}

/**
 * Parses the studio variant of the public site-config envelope. Requires the
 * studio desk configuration (`studioHome`, `studioDesks`) that the dashboard
 * depends on; the backend always serializes these fields.
 */
export function parseStudioSiteConfigEnvelope(
    value: unknown,
): ApiEnvelope<SiteConfig> | null {
    return parseEnvelope(value, (data) => {
        if (!isRecord(data) || !isStringArray(data.enabledModules)) {
            return null
        }

        const tenant = parseTenantInfo(data)
        const branding = parseBranding(data)
        const studioHome = parseStudioHome(data.studioHome)
        const studioDesks = parseStudioDesks(data.studioDesks)
        if (
            tenant === null ||
            branding === null ||
            studioHome === null ||
            studioDesks === null
        ) {
            return null
        }

        return {
            tenant,
            enabledModules: data.enabledModules,
            branding,
            publicSiteUrl: isNullableString(data.publicSiteUrl) ? data.publicSiteUrl : null,
            publicRssUrl: isNullableString(data.publicRssUrl)
                ? data.publicRssUrl
                : null,
            publicArticleRssUrl: isNullableString(data.publicArticleRssUrl)
                ? data.publicArticleRssUrl
                : null,
            analytics: parseSiteAnalytics(data.analytics),
            studioHome,
            studioDesks,
            emailNotifyAvailable: data.emailNotifyAvailable === true,
        }
    })
}

// ---------------------------------------------------------------------------
// Tenant settings: branding / domains / users / subscribers / templates
// ---------------------------------------------------------------------------

function parseTenantBranding(value: unknown): TenantBranding | null {
    if (
        !isRecord(value) ||
        !isNullableString(value.siteTitle, 255) ||
        !isNullableString(value.primaryColor, 16) ||
        !isNullableString(value.secondaryColor, 16) ||
        !isNullableString(value.logoUrl, 2048) ||
        !isNullableString(value.umamiWebsiteId, 64) ||
        !isNullableString(value.umamiHostUrl, 512)
    ) {
        return null
    }

    return {
        siteTitle: value.siteTitle,
        primaryColor: value.primaryColor,
        secondaryColor: value.secondaryColor,
        logoUrl: value.logoUrl,
        umamiWebsiteId: value.umamiWebsiteId,
        umamiHostUrl: value.umamiHostUrl,
    }
}

export function parseBrandingEnvelope(
    value: unknown,
): ApiEnvelope<TenantBranding> | null {
    return parseEnvelope(value, parseTenantBranding)
}

function parseTenantDomain(value: unknown): TenantDomain | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.host, 253) ||
        typeof value.primary !== 'boolean' ||
        typeof value.verified !== 'boolean'
    ) {
        return null
    }

    return {
        host: value.host,
        primary: value.primary,
        verified: value.verified,
    }
}

export function parseDomainListEnvelope(
    value: unknown,
): ApiEnvelope<TenantDomain[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 100, parseTenantDomain),
    )
}

export function parseDomainEnvelope(
    value: unknown,
): ApiEnvelope<TenantDomain> | null {
    return parseEnvelope(value, parseTenantDomain)
}

function parseDomainVerificationChallenge(
    value: unknown,
): DomainVerificationChallenge | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.host, 253) ||
        !isBoundedString(value.token, 512) ||
        !isBoundedString(value.dnsTxtValue, 512) ||
        !isBoundedString(value.dnsNameHint, 512)
    ) {
        return null
    }

    return {
        host: value.host,
        token: value.token,
        dnsTxtValue: value.dnsTxtValue,
        dnsNameHint: value.dnsNameHint,
    }
}

export function parseDomainVerificationEnvelope(
    value: unknown,
): ApiEnvelope<DomainVerificationChallenge> | null {
    return parseEnvelope(value, parseDomainVerificationChallenge)
}

function isMembershipStatus(value: unknown): value is MembershipStatus {
    return value === 'ACTIVE' || value === 'INVITED' || value === 'DISABLED'
}

function parseTenantUser(value: unknown): TenantUser | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.userId) ||
        !isBoundedString(value.email, 254) ||
        !isValidEmail(value.email) ||
        !isNullableString(value.name, 200) ||
        !isStringArray(value.roles) ||
        !isMembershipStatus(value.status) ||
        !isNullableString(value.invitedAt, 64) ||
        !isNullableString(value.lastLoginAt, 64)
    ) {
        return null
    }

    return {
        userId: value.userId,
        email: value.email,
        name: value.name,
        roles: value.roles,
        status: value.status,
        invitedAt: value.invitedAt,
        lastLoginAt: value.lastLoginAt,
    }
}

export function parseTenantUserListEnvelope(
    value: unknown,
): ApiEnvelope<TenantUser[]> | null {
    return parseEnvelope(value, (data) => parseBoundedArray(data, 500, parseTenantUser))
}

export function parseTenantUserEnvelope(
    value: unknown,
): ApiEnvelope<TenantUser> | null {
    return parseEnvelope(value, parseTenantUser)
}

function parseInviteTenantUserResponse(value: unknown): InviteTenantUserResponse | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.email, 254) ||
        !isValidEmail(value.email) ||
        !isBoundedString(value.role) ||
        !isBoundedString(value.status) ||
        !(value.inviteToken === null || isBoundedString(value.inviteToken, 512))
    ) {
        return null
    }

    return {
        email: value.email,
        role: value.role,
        status: value.status,
        inviteToken: value.inviteToken,
    }
}

export function parseInviteTenantUserEnvelope(
    value: unknown,
): ApiEnvelope<InviteTenantUserResponse> | null {
    return parseEnvelope(value, parseInviteTenantUserResponse)
}

// ---------------------------------------------------------------------------
// Subscriber feed admin views (tenant scope)
// ---------------------------------------------------------------------------

function parseSubscriberFeedAdminView(value: unknown): SubscriberFeedAdminView | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.userId) ||
        !isBoundedString(value.userEmail, 255) ||
        !isBoundedString(value.title, 255) ||
        typeof value.isDefault !== 'boolean' ||
        typeof value.enabled !== 'boolean' ||
        !isBoundedString(value.createdAt, 64) ||
        !isBoundedString(value.updatedAt, 64)
    ) {
        return null
    }

    const formatIds =
        value.formatIds === undefined
            ? []
            : Array.isArray(value.formatIds) &&
                value.formatIds.length <= 50 &&
                value.formatIds.every(isPositiveSafeInteger)
              ? value.formatIds
              : null
    const formats =
        value.formats === undefined ? [] : parseTagArray(value.formats)
    if (formatIds === null || formats === null) {
        return null
    }

    return {
        id: value.id,
        userId: value.userId,
        userEmail: value.userEmail,
        title: value.title,
        isDefault: value.isDefault,
        enabled: value.enabled,
        formatIds,
        formats,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    }
}

export function parseSubscriberFeedAdminListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeedAdminView[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 1000, parseSubscriberFeedAdminView),
    )
}

export function parseSubscriberFeedAdminEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeedAdminView> | null {
    return parseEnvelope(value, parseSubscriberFeedAdminView)
}

// ---------------------------------------------------------------------------
// Article feed admin views (tenant scope)
// ---------------------------------------------------------------------------

function parsePublicCategoryForFeed(value: unknown): PublicCategory | null {
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

function parseArticleFeedAdminView(value: unknown): ArticleFeedAdminView | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.userId) ||
        !isBoundedString(value.userEmail, 255) ||
        !isBoundedString(value.title, 255) ||
        typeof value.isDefault !== 'boolean' ||
        typeof value.enabled !== 'boolean' ||
        !isBoundedString(value.createdAt, 64) ||
        !isBoundedString(value.updatedAt, 64)
    ) {
        return null
    }

    const categoryIds =
        value.categoryIds === undefined
            ? []
            : Array.isArray(value.categoryIds) &&
                value.categoryIds.length <= 50 &&
                value.categoryIds.every(isPositiveSafeInteger)
              ? value.categoryIds
              : null
    const categories =
        value.categories === undefined
            ? []
            : parseBoundedArray(value.categories, 50, parsePublicCategoryForFeed)
    if (categoryIds === null || categories === null) {
        return null
    }

    return {
        id: value.id,
        userId: value.userId,
        userEmail: value.userEmail,
        title: value.title,
        isDefault: value.isDefault,
        enabled: value.enabled,
        categoryIds,
        categories,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    }
}

export function parseArticleFeedAdminListEnvelope(
    value: unknown,
): ApiEnvelope<ArticleFeedAdminView[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 1000, parseArticleFeedAdminView),
    )
}

export function parseArticleFeedAdminEnvelope(
    value: unknown,
): ApiEnvelope<ArticleFeedAdminView> | null {
    return parseEnvelope(value, parseArticleFeedAdminView)
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

function parseTenantSubscriberSubscription(
    value: unknown,
): TenantSubscriberSubscription | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.productId) ||
        !isBoundedString(value.productSlug, 128) ||
        !isBoundedString(value.productTitle, 255) ||
        !isBoundedString(value.status, 64) ||
        !isBoundedString(value.source, 64) ||
        !isNullableString(value.startedAt, 64) ||
        !isNullableString(value.endsAt, 64) ||
        !isNullableString(value.externalSubscriptionId, 64)
    ) {
        return null
    }

    return {
        id: value.id,
        productId: value.productId,
        productSlug: value.productSlug,
        productTitle: value.productTitle,
        status: value.status,
        source: value.source,
        startedAt: value.startedAt,
        endsAt: value.endsAt,
        externalSubscriptionId: value.externalSubscriptionId,
    }
}

function parseTenantSubscriber(value: unknown): TenantSubscriber | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.userId) ||
        !isBoundedString(value.email, 254) ||
        !isNullableString(value.name, 255) ||
        !isBoundedString(value.status, 64) ||
        !Array.isArray(value.subscriptions) ||
        value.subscriptions.length > 100
    ) {
        return null
    }

    const subscriptions: TenantSubscriberSubscription[] = []
    for (const item of value.subscriptions) {
        const subscription = parseTenantSubscriberSubscription(item)
        if (subscription === null) {
            return null
        }
        subscriptions.push(subscription)
    }

    return {
        userId: value.userId,
        email: value.email,
        name: value.name,
        status: value.status,
        subscriptions,
    }
}

export function parseSubscriberListEnvelope(
    value: unknown,
): ApiEnvelope<TenantSubscriber[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 5000, parseTenantSubscriber),
    )
}

// ---------------------------------------------------------------------------
// Content email templates
// ---------------------------------------------------------------------------

function parseContentEmailTemplateType(
    value: unknown,
): ContentEmailTemplateType | null {
    return value === 'EPISODE' || value === 'ARTICLE' ? value : null
}

function parseContentEmailTemplate(value: unknown): ContentEmailTemplate | null {
    if (!isRecord(value)) {
        return null
    }

    const contentType = parseContentEmailTemplateType(value.contentType)
    if (
        contentType === null ||
        !isBoundedString(value.subjectTemplate, 512) ||
        !isBoundedString(value.bodyHtml, 65_535) ||
        !isNullableString(value.updatedAt, 64)
    ) {
        return null
    }

    return {
        contentType,
        subjectTemplate: value.subjectTemplate,
        bodyHtml: value.bodyHtml,
        updatedAt: value.updatedAt,
    }
}

export function parseContentEmailTemplateEnvelope(
    value: unknown,
): ApiEnvelope<ContentEmailTemplate | null> | null {
    if (!isRecord(value) || !isValidHttpStatus(value.statusCode)) {
        return null
    }

    let data: ContentEmailTemplate | null
    if (value.data === null) {
        data = null
    } else {
        data = parseContentEmailTemplate(value.data)
        if (data === null) {
            return null
        }
    }

    return {
        statusCode: value.statusCode,
        statusMessage: isBoundedString(value.statusMessage) ? value.statusMessage : '',
        data,
        errors: [],
        metadata: {},
    }
}

// ---------------------------------------------------------------------------
// Stripe / billing dashboard
// ---------------------------------------------------------------------------

function parseStripeStatus(value: unknown): StripeStatus | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.status, 64) ||
        typeof value.moduleEnabled !== 'boolean' ||
        !isBoundedString(value.message, 512) ||
        typeof value.chargesEnabled !== 'boolean' ||
        typeof value.payoutsEnabled !== 'boolean' ||
        typeof value.detailsSubmitted !== 'boolean'
    ) {
        return null
    }

    return {
        status: value.status,
        moduleEnabled: value.moduleEnabled,
        message: value.message,
        chargesEnabled: value.chargesEnabled,
        payoutsEnabled: value.payoutsEnabled,
        detailsSubmitted: value.detailsSubmitted,
    }
}

function parseBillingStats(value: unknown): BillingStats | null {
    if (
        !isRecord(value) ||
        !isNonNegativeSafeInteger(value.activeSubscriptions) ||
        !isNonNegativeSafeInteger(value.activePaidSubscriptions) ||
        !isNonNegativeSafeInteger(value.activeGrantSubscriptions) ||
        !isNonNegativeSafeInteger(value.uniqueActiveMembers) ||
        !isNonNegativeSafeInteger(value.newThisMonth) ||
        !isNonNegativeSafeInteger(value.canceledThisMonth) ||
        !isNonNegativeSafeInteger(value.pastDueSubscriptions) ||
        !isNonNegativeSafeInteger(value.incompleteSubscriptions) ||
        !isNonNegativeSafeInteger(value.totalMemberships) ||
        !isNonNegativeSafeInteger(value.estimatedMonthlyCents) ||
        !isBoundedString(value.currency, 3)
    ) {
        return null
    }
    return {
        activeSubscriptions: value.activeSubscriptions,
        activePaidSubscriptions: value.activePaidSubscriptions,
        activeGrantSubscriptions: value.activeGrantSubscriptions,
        uniqueActiveMembers: value.uniqueActiveMembers,
        newThisMonth: value.newThisMonth,
        canceledThisMonth: value.canceledThisMonth,
        pastDueSubscriptions: value.pastDueSubscriptions,
        incompleteSubscriptions: value.incompleteSubscriptions,
        totalMemberships: value.totalMemberships,
        estimatedMonthlyCents: value.estimatedMonthlyCents,
        currency: value.currency,
    }
}

function parseBillingMembership(value: unknown): BillingMembership | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isPositiveSafeInteger(value.userId) ||
        !isBoundedString(value.email, 320) ||
        !isPositiveSafeInteger(value.productId) ||
        !isBoundedString(value.productSlug, 128) ||
        !isBoundedString(value.productTitle) ||
        !isBoundedString(value.status, 32) ||
        !isBoundedString(value.source, 32) ||
        !isNullableString(value.startedAt, 64) ||
        !isNullableString(value.endsAt, 64) ||
        !isNullableString(value.externalSubscriptionId, 64)
    ) {
        return null
    }
    return {
        id: value.id,
        userId: value.userId,
        email: value.email,
        productId: value.productId,
        productSlug: value.productSlug,
        productTitle: value.productTitle,
        status: value.status,
        source: value.source,
        startedAt: value.startedAt,
        endsAt: value.endsAt,
        externalSubscriptionId: value.externalSubscriptionId,
    }
}

function parseBillingDashboard(value: unknown): BillingDashboard | null {
    if (!isRecord(value)) {
        return null
    }
    const stripe = parseStripeStatus(value.stripe)
    const stats = parseBillingStats(value.stats)
    if (
        stripe === null ||
        stats === null ||
        !Array.isArray(value.memberships) ||
        value.memberships.length > 100
    ) {
        return null
    }
    const memberships = parseBoundedArray(value.memberships, 100, parseBillingMembership)
    if (memberships === null) {
        return null
    }
    return {stripe, stats, memberships}
}

export function parseBillingDashboardEnvelope(
    value: unknown,
): ApiEnvelope<BillingDashboard> | null {
    return parseEnvelope(value, parseBillingDashboard)
}

export function parseStripeStatusEnvelope(
    value: unknown,
): ApiEnvelope<StripeStatus> | null {
    return parseEnvelope(value, parseStripeStatus)
}
