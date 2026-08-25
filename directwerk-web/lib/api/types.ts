interface ApiErrorDetail {
    code: string
    message: string
    field: string | null
}

export type AccessPolicy = 'FREE' | 'PAID'

export interface ApiEnvelope<T> {
    statusCode: number
    statusMessage: string
    data: T
    errors: ApiErrorDetail[]
    metadata: Record<string, unknown>
}

export interface TokenResponse {
    access_token: string
    refresh_token?: string
    token_type?: string
    expires_in?: number
}

export interface Me {
    email: string
    name: string | null
    roles: string[]
    tenantId: number
}

export interface AccessLevel {
    id: number
    slug: string
    title: string
    sortOrder: number
}

export interface Access {
    activeLevels: AccessLevel[]
    maxLevelSortOrder: number | null
    roles: string[]
    tenantId: number
}

export interface SubscriptionSummary {
    id: number
    productId: number
    productSlug: string
    productTitle: string
    offeringType: string
    status: string
    source: string
    startedAt: string | null
    endsAt: string | null
}

export interface SiteConfig {
    tenant: {
        slug: string
        name: string
    }
    enabledModules: string[]
    branding: {
        siteTitle: string | null
        primaryColor: string | null
        secondaryColor: string | null
        logoUrl: string | null
    }
    publicRssUrl: string | null
}

export interface MediaAsset {
    id: number
    s3Key: string
    visibility: string
    scope: string
    assetType: string
    status: string
    mimeType: string | null
    sizeBytes: number | null
    originalFilename: string | null
    episodeId: number | null
    ownerUserId: number | null
    cdnUrl: string | null
    createdAt: string
    updatedAt: string
}

export interface PublicCategory {
    id: number
    slug: string
    name: string
    parentId: number | null
}

export interface PublicArticle {
    id: number
    slug: string
    title: string
    body: string | null
    excerpt: string | null
    seoDescription: string | null
    heroAssetId: number | null
    accessPolicy: AccessPolicy
    requiredLevelSortOrder: number | null
    publishedAt: string | null
    categories: PublicCategory[]
}

export interface PublicSeries {
    id: number
    slug: string
    title: string
    description: string | null
    coverAssetId: number | null
    language: string | null
    itunesCategory: string | null
}

export interface PublicEpisode {
    id: number
    seriesId: number
    seriesSlug: string
    episodeNumber: number | null
    slug: string
    title: string
    description: string | null
    durationSeconds: number | null
    accessPolicy: AccessPolicy
    requiredLevelSortOrder: number | null
    publishedAt: string | null
    audioCdnUrl: string | null
}

/** Entitled bonus file from GET /api/v1/me/downloads */
export interface SubscriberDownload {
    id: number
    title: string
    assetType: string
    mimeType: string | null
    sizeBytes: number | null
    downloadUrl: string
}

export interface PublicFormat {
    id: number
    slug: string
    name: string
    description: string | null
    requiredLevelSortOrder: number | null
    sortOrder: number
}

export interface FeedFormat {
    id: number
    slug: string
    name: string
    requiredLevelSortOrder: number | null
    sortOrder: number
}

export interface FeedPreview {
    episodeCount: number
    sampleTitles: string[]
}

/** Private subscriber RSS feed from GET /api/v1/me/feeds */
export interface SubscriberFeed {
    id: number
    title: string
    isDefault: boolean
    enabled: boolean
    url: string
    formatIds: number[]
    formats: FeedFormat[]
    createdAt: string
    updatedAt: string
}

