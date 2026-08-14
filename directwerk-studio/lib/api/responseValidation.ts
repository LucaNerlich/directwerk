import type {
    AccessPolicy,
    ApiEnvelope,
    ArticleDetail,
    BillingDashboard,
    BillingInterval,
    BillingMembership,
    BillingStats,
    ArticleSummary,
    CategorySummary,
    CategoryTag,
    ContentEmailTemplate,
    ContentEmailTemplateType,
    DomainVerificationChallenge,
    EpisodeDetail,
    EpisodeSummary,
    FormatSummary,
    FormatTag,
    InviteTenantUserResponse,
    Me,
    MediaAsset,
    MembershipStatus,
    OfferingType,
    ProductAccessRule,
    ProductAccessScopeType,
    PublicationStatus,
    SeriesDetail,
    SeriesStatus,
    SeriesSummary,
    SiteConfig,
    StripeStatus,
    SubscriberFeedSummary,
    SubscriptionGrant,
    SubscriptionProduct,
    Tag,
    TenantBranding,
    TenantDomain,
    TenantSubscriber,
    TenantSubscriberSubscription,
    TenantUser,
    TokenResponse,
    UploadUrlResult,
} from '@/lib/api/types'

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
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
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

function isPublicationStatus(value: unknown): value is PublicationStatus {
    return (
        value === 'DRAFT' ||
        value === 'SCHEDULED' ||
        value === 'PUBLISHED' ||
        value === 'ARCHIVED'
    )
}

function isAccessPolicy(value: unknown): value is AccessPolicy {
    return value === 'FREE' || value === 'PAID'
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

function parseStudioDesks(value: unknown): SiteConfig['studioDesks'] | null {
    if (!Array.isArray(value) || value.length > 2) {
        return null
    }

    const desks: SiteConfig['studioDesks'] = []
    for (const item of value) {
        if (item === 'WRITE' || item === 'PODCAST') {
            desks.push(item)
        } else {
            return null
        }
    }

    return desks
}

function parseStudioHome(value: unknown): SiteConfig['studioHome'] | null {
    if (value === 'OVERVIEW' || value === 'WRITE_DESK' || value === 'PODCAST_DESK') {
        return value
    }

    return null
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

        const studioHome = parseStudioHome(data.studioHome)
        const studioDesks = parseStudioDesks(data.studioDesks)
        if (studioHome === null || studioDesks === null) {
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
            studioHome,
            studioDesks,
            emailNotifyAvailable: data.emailNotifyAvailable === true,
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

        return {
            email: data.email,
            name: data.name,
            roles: data.roles,
            tenantId: data.tenantId,
        }
    })
}

/**
 * Parses an article summary from an unknown value.
 *
 * @param value - The value to parse
 * @returns The parsed article summary, or `null` if the value is invalid
 */
function parseArticleSummary(value: unknown): ArticleSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isPublicationStatus(value.status) ||
        !isAccessPolicy(value.accessPolicy)
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

/**
 * Parses an unknown value as a tag.
 *
 * @param value - The value to validate and parse
 * @returns A parsed tag, or `null` if the value is invalid
 */
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

/**
 * Parses an array of validated tags.
 *
 * @param value - The value to parse as an array containing at most 100 tags
 * @returns The parsed tags, or `null` if the value is not a valid tag array
 */
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

/**
 * Parses an article detail from an unknown value.
 *
 * @param value - The value to parse
 * @returns The parsed article detail, or `null` if the value is invalid
 */
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
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: ArticleDetail[] = []
        for (const item of data) {
            const article = parseArticleDetail(item)
            if (article === null) {
                return null
            }
            parsed.push(article)
        }

        return parsed
    })
}

export function parseArticleEnvelope(
    value: unknown,
): ApiEnvelope<ArticleDetail> | null {
    return envelope(value, parseArticleDetail)
}

function parseEpisodeSummary(value: unknown): EpisodeSummary | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.slug) ||
        !isBoundedString(value.title) ||
        !isPublicationStatus(value.status) ||
        !isAccessPolicy(value.accessPolicy)
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

/**
 * Parses an API response into an episode detail object.
 *
 * @param value - The value to validate and parse
 * @returns The parsed episode detail, or `null` when validation fails
 */
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
        description: isNullableString(value.description, 512_000) ? value.description : null,
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
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: EpisodeDetail[] = []
        for (const item of data) {
            const episode = parseEpisodeDetail(item)
            if (episode === null) {
                return null
            }
            parsed.push(episode)
        }

        return parsed
    })
}

export function parseEpisodeEnvelope(
    value: unknown,
): ApiEnvelope<EpisodeDetail> | null {
    return envelope(value, parseEpisodeDetail)
}

export function parseSeriesListEnvelope(
    value: unknown,
): ApiEnvelope<SeriesSummary[]> | null {
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 100) {
            return null
        }

        const parsed: SeriesSummary[] = []
        for (const item of data) {
            const series = parseSeriesSummary(item)
            if (series === null) {
                return null
            }
            parsed.push(series)
        }

        return parsed
    })
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

/**
 * Parses a series detail response into a validated series object.
 *
 * @param value - The unknown response value to parse
 * @returns A validated `SeriesDetail` object, or `null` when the value is invalid
 */
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
        defaultRequiredLevelSortOrder: value.defaultRequiredLevelSortOrder,
        rssUrl: value.rssUrl,
    }
}

function isSeriesStatus(value: unknown): value is SeriesStatus {
    return value === 'DRAFT' || value === 'PUBLISHED'
}

export function parseSeriesEnvelope(value: unknown): ApiEnvelope<SeriesDetail> | null {
    return envelope(value, parseSeriesDetail)
}

export function parseUploadUrlEnvelope(
    value: unknown,
): ApiEnvelope<UploadUrlResult> | null {
    return envelope(value, (data) => {
        if (
            !isRecord(data) ||
            !isPositiveSafeInteger(data.assetId) ||
            !isBoundedString(data.uploadUrl, 4096) ||
            data.uploadUrl.length === 0
        ) {
            return null
        }

        const headers: Record<string, string> = {}
        if (isRecord(data.headers)) {
            for (const [key, headerValue] of Object.entries(data.headers)) {
                if (isBoundedString(key, 128) && isBoundedString(headerValue, 2048)) {
                    headers[key] = headerValue
                }
            }
        }

        return {
            assetId: data.assetId,
            uploadUrl: data.uploadUrl,
            expiresAt: isNullableString(data.expiresAt, 64) ? data.expiresAt : null,
            headers,
        }
    })
}

export function parseMediaAssetEnvelope(value: unknown): ApiEnvelope<MediaAsset> | null {
    return envelope(value, parseMediaAsset)
}

function parseMediaAsset(value: unknown): MediaAsset | null {
    if (
        !isRecord(value) ||
        !isPositiveSafeInteger(value.id) ||
        !isBoundedString(value.status) ||
        !isBoundedString(value.assetType)
    ) {
        return null
    }

    return {
        id: value.id,
        status: value.status,
        assetType: value.assetType,
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
        visibility: isNullableString(value.visibility, 32) ? value.visibility : null,
        scope: isNullableString(value.scope, 32) ? value.scope : null,
        cdnUrl: isNullableString(value.cdnUrl, 4096) ? value.cdnUrl : null,
        createdAt: isNullableString(value.createdAt, 64) ? value.createdAt : null,
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

function isNonNegativeSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function parseSubscriptionProduct(value: unknown): SubscriptionProduct | null {
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
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: SubscriptionProduct[] = []
        for (const item of data) {
            const product = parseSubscriptionProduct(item)
            if (product === null) {
                return null
            }
            parsed.push(product)
        }

        return parsed
    })
}

export function parseProductEnvelope(
    value: unknown,
): ApiEnvelope<SubscriptionProduct> | null {
    return envelope(value, parseSubscriptionProduct)
}

export function parseProductAccessRule(value: unknown): ProductAccessRule | null {
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
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: ProductAccessRule[] = []
        for (const item of data) {
            const rule = parseProductAccessRule(item)
            if (rule === null) {
                return null
            }
            parsed.push(rule)
        }

        return parsed
    })
}

export function parseSubscriptionGrant(value: unknown): SubscriptionGrant | null {
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
    return envelope(value, parseSubscriptionGrant)
}

/**
 * Parses an unknown value as a format summary.
 *
 * @returns A validated `FormatSummary`, or `null` if the value is invalid.
 */
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
            (isSafeInteger(value.requiredLevelSortOrder) && value.requiredLevelSortOrder >= 0)
        ) ||
        !isNonNegativeSafeInteger(value.sortOrder)
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
            value.requiredLevelSortOrder === null || value.requiredLevelSortOrder === undefined
                ? null
                : value.requiredLevelSortOrder,
        sortOrder: value.sortOrder,
    }
}

/**
 * Parses an API response containing a list of format summaries.
 *
 * @returns A validated envelope containing up to 500 format summaries, or `null` if the response or any format is invalid.
 */
export function parseFormatListEnvelope(
    value: unknown,
): ApiEnvelope<FormatSummary[]> | null {
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: FormatSummary[] = []
        for (const item of data) {
            const format = parseFormatSummary(item)
            if (format === null) {
                return null
            }
            parsed.push(format)
        }

        return parsed
    })
}

/**
 * Parses an API response containing a format summary.
 *
 * @param value - The unknown API response to parse
 * @returns A validated format summary envelope, or `null` when the response is invalid
 */
export function parseFormatEnvelope(value: unknown): ApiEnvelope<FormatSummary> | null {
    return envelope(value, parseFormatSummary)
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

/**
 * Parses an API response containing a list of category summaries.
 *
 * @param value - The unknown API response to validate
 * @returns The parsed category list envelope, or `null` when validation fails
 */
export function parseCategoryListEnvelope(
    value: unknown,
): ApiEnvelope<CategorySummary[]> | null {
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: CategorySummary[] = []
        for (const item of data) {
            const category = parseCategorySummary(item)
            if (category === null) {
                return null
            }
            parsed.push(category)
        }

        return parsed
    })
}

/**
 * Parses a category response wrapped in an API envelope.
 *
 * @param value - The unknown response value to parse
 * @returns A validated category API envelope, or `null` if the response is invalid
 */
export function parseCategoryEnvelope(value: unknown): ApiEnvelope<CategorySummary> | null {
    return envelope(value, parseCategorySummary)
}

function parseTenantBranding(value: unknown): TenantBranding | null {
    if (
        !isRecord(value) ||
        !isNullableString(value.siteTitle, 255) ||
        !isNullableString(value.primaryColor, 16) ||
        !isNullableString(value.secondaryColor, 16) ||
        !isNullableString(value.logoUrl, 2048) ||
        !isNullableString(value.umamiWebsiteId, 64)
    ) {
        return null
    }

    return {
        siteTitle: value.siteTitle,
        primaryColor: value.primaryColor,
        secondaryColor: value.secondaryColor,
        logoUrl: value.logoUrl,
        umamiWebsiteId: value.umamiWebsiteId,
    }
}

export function parseBrandingEnvelope(value: unknown): ApiEnvelope<TenantBranding> | null {
    return envelope(value, parseTenantBranding)
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
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 100) {
            return null
        }

        const parsed: TenantDomain[] = []
        for (const item of data) {
            const domain = parseTenantDomain(item)
            if (domain === null) {
                return null
            }
            parsed.push(domain)
        }

        return parsed
    })
}

export function parseDomainEnvelope(value: unknown): ApiEnvelope<TenantDomain> | null {
    return envelope(value, parseTenantDomain)
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
    return envelope(value, parseDomainVerificationChallenge)
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
        !isMembershipStatus(value.status)
    ) {
        return null
    }

    return {
        userId: value.userId,
        email: value.email,
        name: value.name,
        roles: value.roles,
        status: value.status,
    }
}

export function parseTenantUserListEnvelope(
    value: unknown,
): ApiEnvelope<TenantUser[]> | null {
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 500) {
            return null
        }

        const parsed: TenantUser[] = []
        for (const item of data) {
            const user = parseTenantUser(item)
            if (user === null) {
                return null
            }
            parsed.push(user)
        }

        return parsed
    })
}

export function parseTenantUserEnvelope(value: unknown): ApiEnvelope<TenantUser> | null {
    return envelope(value, parseTenantUser)
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
    return envelope(value, parseInviteTenantUserResponse)
}

function parseSubscriberFeedSummary(value: unknown): SubscriberFeedSummary | null {
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

    return {
        id: value.id,
        userId: value.userId,
        userEmail: value.userEmail,
        title: value.title,
        isDefault: value.isDefault,
        enabled: value.enabled,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
    }
}

export function parseSubscriberFeedListEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeedSummary[]> | null {
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 1000) {
            return null
        }

        const parsed: SubscriberFeedSummary[] = []
        for (const item of data) {
            const feed = parseSubscriberFeedSummary(item)
            if (feed === null) {
                return null
            }
            parsed.push(feed)
        }

        return parsed
    })
}

export function parseSubscriberFeedEnvelope(
    value: unknown,
): ApiEnvelope<SubscriberFeedSummary> | null {
    return envelope(value, parseSubscriberFeedSummary)
}

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
    return envelope(value, (data) => {
        if (!Array.isArray(data) || data.length > 5000) {
            return null
        }

        const parsed: TenantSubscriber[] = []
        for (const item of data) {
            const subscriber = parseTenantSubscriber(item)
            if (subscriber === null) {
                return null
            }
            parsed.push(subscriber)
        }

        return parsed
    })
}

function parseContentEmailTemplateType(
    value: unknown,
): ContentEmailTemplateType | null {
    return value === 'EPISODE' || value === 'ARTICLE' ? value : null
}

function parseContentEmailTemplate(value: unknown): ContentEmailTemplate | null {
    if (value === null) {
        return null
    }
    if (
        !isRecord(value) ||
        parseContentEmailTemplateType(value.contentType) === null ||
        !isBoundedString(value.subjectTemplate, 512) ||
        !isBoundedString(value.bodyHtml, 65_535) ||
        !isNullableString(value.updatedAt, 64)
    ) {
        return null
    }

    return {
        contentType: value.contentType as ContentEmailTemplateType,
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
        statusMessage: isBoundedString(value.statusMessage)
            ? value.statusMessage
            : '',
        data,
        errors: [],
        metadata: {},
    }
}

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
    if (stripe === null || stats === null || !Array.isArray(value.memberships) || value.memberships.length > 100) {
        return null
    }
    const memberships: BillingMembership[] = []
    for (const item of value.memberships) {
        const row = parseBillingMembership(item)
        if (row === null) {
            return null
        }
        memberships.push(row)
    }
    return {stripe, stats, memberships}
}

export function parseBillingDashboardEnvelope(
    value: unknown,
): ApiEnvelope<BillingDashboard> | null {
    return envelope(value, parseBillingDashboard)
}

export function parseStripeOnboardEnvelope(value: unknown): string | null {
    if (!isRecord(value) || !isRecord(value.data)) {
        return null
    }
    const url = value.data.url
    if (!isBoundedString(url, 4096)) {
        return null
    }
    return url
}

export function parseStripeStatusEnvelope(
    value: unknown,
): ApiEnvelope<StripeStatus> | null {
    return envelope(value, parseStripeStatus)
}
