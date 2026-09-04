import type {
    Access,
    ApiEnvelope,
    ArticleFeedPreview,
    ArticleFeedView,
    BillingInterval,
    FeedFormat,
    FeedPreview,
    OfferingType,
    PackageSummary,
    PublicArticle,
    PublicCategory,
    PublicEpisode,
    PublicFormat,
    PublicProduct,
    PublicSeries,
    PublicSiteConfig,
    SiteAnalytics,
    SubscriberDownload,
    SubscriberFeedView,
    SubscriptionSummary,
} from '../types'
import {
    isAllowedFeedUrl,
    isBoundedString,
    isNonNegativeSafeInteger,
    isNullableNonNegativeSafeInteger,
    isNullableSafeInteger,
    isNullableString,
    isPositiveSafeInteger,
    isRecord,
    isSafeInteger,
    isStringArray,
    parseBoundedArray,
    parseEnvelope,
} from './primitives'
// ---------------------------------------------------------------------------
// Site configuration (public shape)
// ---------------------------------------------------------------------------

/** Parses Umami analytics from public site config; invalid payloads become null. */
export function parseSiteAnalytics(value: unknown): SiteAnalytics | null {
    if (value === null || value === undefined) {
        return null
    }
    if (
        !isRecord(value) ||
        !isBoundedString(value.umamiWebsiteId, 64) ||
        value.umamiWebsiteId.trim().length === 0 ||
        !isBoundedString(value.umamiHostUrl, 512) ||
        !isAllowedFeedUrl(value.umamiHostUrl) ||
        !isBoundedString(value.umamiScriptUrl, 512) ||
        !isAllowedFeedUrl(value.umamiScriptUrl)
    ) {
        return null
    }

    return {
        umamiWebsiteId: value.umamiWebsiteId.trim(),
        umamiHostUrl: value.umamiHostUrl.trim().replace(/\/+$/, ''),
        umamiScriptUrl: value.umamiScriptUrl.trim(),
    }
}

/** Parses the anonymous-visitor site-config envelope. */
export function parsePublicSiteConfigEnvelope(
    value: unknown,
): ApiEnvelope<PublicSiteConfig> | null {
    return parseEnvelope(value, (data) => {
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

        const branding = data.branding as {
            siteTitle: string | null
            primaryColor: string | null
            secondaryColor: string | null
            logoUrl: string | null
        }

        return {
            tenant: {slug: data.tenant.slug, name: data.tenant.name},
            enabledModules: data.enabledModules,
            branding,
            publicSiteUrl: isNullableString(data.publicSiteUrl) ? data.publicSiteUrl : null,
            publicRssUrl:
                isNullableString(data.publicRssUrl) &&
                data.publicRssUrl !== null &&
                isAllowedFeedUrl(data.publicRssUrl)
                    ? data.publicRssUrl
                    : null,
            publicArticleRssUrl:
                isNullableString(data.publicArticleRssUrl) &&
                data.publicArticleRssUrl !== null &&
                isAllowedFeedUrl(data.publicArticleRssUrl)
                    ? data.publicArticleRssUrl
                    : null,
            analytics: parseSiteAnalytics(data.analytics),
            emailNotifyAvailable: data.emailNotifyAvailable === true,
        }
    })
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

function parseAccessLevel(value: unknown): Access['activeLevels'][number] | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isSafeInteger(value.sortOrder)
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

function parsePackageSummary(value: unknown): PackageSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title)
    ) {
        return null
    }

    return {
        id: value.id,
        slug: value.slug,
        title: value.title,
    }
}

export function parseAccessEnvelope(value: unknown): ApiEnvelope<Access> | null {
    return parseEnvelope(value, (data) => {
        if (
            !isRecord(data) ||
            !isStringArray(data.roles) ||
            !isPositiveSafeInteger(data.tenantId)
        ) {
            return null
        }

        if (!isNullableSafeInteger(data.maxLevelSortOrder)) {
            return null
        }

        const activeLevels = parseBoundedArray(
            data.activeLevels,
            100,
            parseAccessLevel,
        )
        if (activeLevels === null) {
            return null
        }

        const activePackages = parseBoundedArray(
            data.activePackages,
            100,
            parsePackageSummary,
        )
        if (activePackages === null) {
            return null
        }

        return {
            activeLevels,
            maxLevelSortOrder: data.maxLevelSortOrder,
            activePackages,
            roles: data.roles,
            tenantId: data.tenantId,
        }
    })
}

// ---------------------------------------------------------------------------
// Public content
//
// HTML bodies/descriptions are sanitized through an injected policy so the
// shared tower stays independent of any app's sanitizer implementation.
// ---------------------------------------------------------------------------

export interface PublicContentPolicy {
    /** Sanitizes API-supplied HTML before it reaches the app. */
    sanitizeHtml?: (html: string) => string
}

function sanitize(policy: PublicContentPolicy, html: string): string {
    return policy.sanitizeHtml !== undefined ? policy.sanitizeHtml(html) : html
}

function parsePublicCategoryInternal(value: unknown): PublicCategory | null {
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

export function parsePublicCategoryListEnvelope(
    value: unknown,
): ApiEnvelope<PublicCategory[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 500, parsePublicCategoryInternal),
    )
}

/**
 * Creates the public article/episode parser set. Web injects its HTML
 * sanitizer; the structural guards are shared.
 */
export function createPublicContentParsers(policy: PublicContentPolicy) {
    function parsePublicArticle(value: unknown): PublicArticle | null {
        if (!isRecord(value)) {
            return null
        }

        const accessPolicy =
            value.accessPolicy === 'FREE' || value.accessPolicy === 'PAID'
                ? value.accessPolicy
                : null
        if (
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
            accessPolicy === null ||
            !isNullableNonNegativeSafeInteger(value.requiredLevelSortOrder) ||
            !isNullableString(value.publishedAt, 64) ||
            !Array.isArray(value.categories) ||
            value.categories.length > 100
        ) {
            return null
        }

        const categories = parseBoundedArray(
            value.categories,
            100,
            parsePublicCategoryInternal,
        )
        if (categories === null) {
            return null
        }

        return {
            id: value.id,
            slug: value.slug,
            title: value.title,
            body: value.body === null ? null : sanitize(policy, value.body),
            excerpt: value.excerpt,
            seoDescription: value.seoDescription,
            heroAssetId:
                value.heroAssetId === undefined || value.heroAssetId === null
                    ? null
                    : value.heroAssetId,
            accessPolicy,
            requiredLevelSortOrder: value.requiredLevelSortOrder,
            publishedAt: value.publishedAt,
            categories,
        }
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
            !isNullableString(value.itunesCategory, 128) ||
            !isNullableString(value.rssUrl, 2048)
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
            // Same URL-safety invariant as audioCdnUrl: https (or loopback
            // http). Invalid values are coerced to null so a compromised
            // record cannot turn FeedUrlDisplay hrefs into javascript: XSS.
            rssUrl:
                value.rssUrl !== null && isAllowedFeedUrl(value.rssUrl)
                    ? value.rssUrl
                    : null,
        }
    }

    function parsePublicEpisode(value: unknown): PublicEpisode | null {
        if (!isRecord(value)) {
            return null
        }

        const accessPolicy =
            value.accessPolicy === 'FREE' || value.accessPolicy === 'PAID'
                ? value.accessPolicy
                : null
        if (
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
            accessPolicy === null ||
            !isNullableNonNegativeSafeInteger(value.requiredLevelSortOrder) ||
            !isNullableString(value.publishedAt, 64) ||
            !isNullableString(value.audioCdnUrl, 4096)
        ) {
            return null
        }

        // Same URL-safety invariant as every other API-supplied URL: https (or
        // loopback http). Invalid values are coerced to null instead of failing
        // the whole episode.
        const audioCdnUrl =
            value.audioCdnUrl !== null && isAllowedFeedUrl(value.audioCdnUrl)
                ? value.audioCdnUrl
                : null

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
                    : sanitize(policy, value.description),
            durationSeconds:
                value.durationSeconds === undefined || value.durationSeconds === null
                    ? null
                    : value.durationSeconds,
            accessPolicy,
            requiredLevelSortOrder: value.requiredLevelSortOrder,
            publishedAt: value.publishedAt,
            audioCdnUrl,
        }
    }

    return {
        parsePublicArticle,

        parsePublicArticleListEnvelope(
            value: unknown,
        ): ApiEnvelope<PublicArticle[]> | null {
            return parseEnvelope(value, (data) =>
                parseBoundedArray(data, 500, parsePublicArticle),
            )
        },

        parsePublicArticleEnvelope(value: unknown): ApiEnvelope<PublicArticle> | null {
            return parseEnvelope(value, parsePublicArticle)
        },

        parsePublicSeries,

        parsePublicSeriesListEnvelope(
            value: unknown,
        ): ApiEnvelope<PublicSeries[]> | null {
            return parseEnvelope(value, (data) =>
                parseBoundedArray(data, 100, parsePublicSeries),
            )
        },

        parsePublicEpisode,

        parsePublicEpisodeListEnvelope(
            value: unknown,
        ): ApiEnvelope<PublicEpisode[]> | null {
            return parseEnvelope(value, (data) =>
                parseBoundedArray(data, 500, parsePublicEpisode),
            )
        },
    }
}

// ---------------------------------------------------------------------------
// Formats (public + feed projections)
// ---------------------------------------------------------------------------

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
    return parseEnvelope(value, (data) => parseBoundedArray(data, 100, parsePublicFormat))
}

// ---------------------------------------------------------------------------
// Subscriber feeds / downloads / subscriptions
// ---------------------------------------------------------------------------

function parseSubscriberFeedView(value: unknown): SubscriberFeedView | null {
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

export function parseSubscriberFeedListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeedView[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 50, parseSubscriberFeedView),
    )
}

export function parseSubscriberFeedEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeedView> | null {
    return parseEnvelope(value, parseSubscriberFeedView)
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
    return parseEnvelope(value, parseFeedPreview)
}

function parseArticleFeedView(value: unknown): ArticleFeedView | null {
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

    const categoryIds =
        value.categoryIds === undefined
            ? []
            : parseBoundedArray(value.categoryIds, 50, (item) =>
                  isPositiveSafeInteger(item) ? item : null,
              )
    const categories =
        value.categories === undefined
            ? []
            : parseBoundedArray(value.categories, 50, parsePublicCategoryInternal)
    if (categoryIds === null || categories === null) {
        return null
    }

    return {
        id: value.id,
        title: value.title,
        isDefault: value.isDefault,
        enabled: value.enabled,
        url: value.url,
        categoryIds,
        categories,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    }
}

export function parseArticleFeedListEnvelope(
    value: unknown,
): ApiEnvelope<ArticleFeedView[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 50, parseArticleFeedView),
    )
}

export function parseArticleFeedEnvelope(
    value: unknown,
): ApiEnvelope<ArticleFeedView> | null {
    return parseEnvelope(value, parseArticleFeedView)
}

function parseArticleFeedPreview(value: unknown): ArticleFeedPreview | null {
    if (
        !isRecord(value) ||
        !isSafeInteger(value.articleCount) ||
        value.articleCount < 0 ||
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
    return {articleCount: value.articleCount, sampleTitles}
}

export function parseArticleFeedPreviewEnvelope(
    value: unknown,
): ApiEnvelope<ArticleFeedPreview> | null {
    return parseEnvelope(value, parseArticleFeedPreview)
}

function parseSubscriberDownload(value: unknown): SubscriberDownload | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.title) ||
        !isBoundedString(value.assetType, 64) ||
        !isNullableString(value.mimeType, 128) ||
        (value.sizeBytes != null &&
            !(
                typeof value.sizeBytes === 'number' &&
                Number.isSafeInteger(value.sizeBytes) &&
                value.sizeBytes >= 0
            )) ||
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
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 50, parseSubscriberDownload),
    )
}


function isOfferingType(value: unknown): value is OfferingType {
    return value === 'LEVEL' || value === 'PACKAGE'
}
function isBillingInterval(value: unknown): value is BillingInterval {
    return value === 'MONTH' || value === 'YEAR' || value === 'ONE_TIME'
}
function parsePublicProduct(value: unknown): PublicProduct | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isOfferingType(value.offeringType) ||
        !isNonNegativeSafeInteger(value.sortOrder) ||
        !isNullableString(value.description, 2000) ||
        !(value.priceCents === null || isNonNegativeSafeInteger(value.priceCents)) ||
        !isBoundedString(value.currency, 3) ||
        !isBillingInterval(value.billingInterval)
    ) {
        return null
    }
    return {
        slug: value.slug,
        title: value.title,
        offeringType: value.offeringType,
        sortOrder: value.sortOrder,
        description: value.description,
        priceCents: value.priceCents,
        currency: value.currency,
        billingInterval: value.billingInterval,
    }
}
export function parsePublicProductListEnvelope(
    value: unknown,
): ApiEnvelope<PublicProduct[]> | null {
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 200, parsePublicProduct),
    )
}

/** Validates a checkout/portal `{data: {url}}` reply. */
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
    return parseEnvelope(value, (data) =>
        parseBoundedArray(data, 200, parseSubscriptionSummary),
    )
}

export interface NotificationPreferences {
    emailNotificationsEnabled: boolean
    emailNotifyAvailable: boolean
}

function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
    if (
        !isRecord(value) ||
        typeof value.emailNotificationsEnabled !== 'boolean' ||
        typeof value.emailNotifyAvailable !== 'boolean'
    ) {
        return null
    }

    return {
        emailNotificationsEnabled: value.emailNotificationsEnabled,
        emailNotifyAvailable: value.emailNotifyAvailable,
    }
}

export function parseNotificationPreferencesEnvelope(
    value: unknown,
): NotificationPreferences | null {
    return parseEnvelope(value, parseNotificationPreferences)?.data ?? null
}
