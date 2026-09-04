import type {
    ASSET_STATUSES,
    ASSET_TYPES,
    ASSET_VISIBILITIES,
    JOB_STATUSES,
    TenantInvitableRole,
} from './constants'
import {MODULE_PRESETS} from './constants'

/** Hand-written DTO types for the Directwerk REST API (backend records are authoritative). */

// ---------------------------------------------------------------------------
// Envelope + auth
// ---------------------------------------------------------------------------

export interface ApiErrorDetail {
    code: string
    message: string
    field: string | null
}

export interface ApiEnvelope<T> {
    statusCode: number
    statusMessage: string
    data: T
    errors: ApiErrorDetail[]
    metadata: Record<string, unknown>
}

/**
 * OAuth2 password-grant token payload from POST /oauth2/token.
 *
 * `token_type` is optional here even though the backend always sends it:
 * the refresh coordinator must tolerate minimal replies.
 */
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

/** Workspace returned by POST /api/v1/auth/studio/workspaces. */
export interface StudioWorkspace {
    tenantId: number
    slug: string
    name: string
    host: string
}

// ---------------------------------------------------------------------------
// Shared enums / primitives
// ---------------------------------------------------------------------------

export type StudioHome = 'OVERVIEW' | 'WRITE_DESK' | 'PODCAST_DESK'

export type StudioDesk = 'WRITE' | 'PODCAST'

export type PublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

export type AccessPolicy = 'FREE' | 'PAID'

export type SeriesStatus = 'DRAFT' | 'PUBLISHED'

export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'DISABLED'

export type AssetType = (typeof ASSET_TYPES)[number]

export type AssetStatus = (typeof ASSET_STATUSES)[number]

export type AssetVisibility = (typeof ASSET_VISIBILITIES)[number]

export type JobStatus = (typeof JOB_STATUSES)[number]

export const KNOWN_JOB_QUEUES = [
    'email',
    'content-notify',
    'stripe-webhook',
    'podcast-rss-feed-refresh',
    'article-rss-feed-refresh',
    'remote-asset-ingest',
    'media-s3-delete',
    'media-cdn-purge',
    'media-staging-cleanup',
] as const

// ---------------------------------------------------------------------------
// Content: articles / episodes / series
// ---------------------------------------------------------------------------

export interface Tag {
    id: number
    slug: string
    name: string
}

export type FormatTag = Tag
export type CategoryTag = Tag

interface ContentSummary {
    id: number
    slug: string
    title: string
    status: PublicationStatus
    accessPolicy: AccessPolicy
    publishedAt: string | null
}

export type EpisodeSummary = ContentSummary

export type ArticleSummary = ContentSummary

export interface EpisodeDetail extends EpisodeSummary {
    seriesId: number
    seriesSlug: string | null
    description: string | null
    episodeNumber: number | null
    audioAssetId: number | null
    coverAssetId: number | null
    enclosureEnabled: boolean
    requiredLevelSortOrder: number | null
    scheduledAt: string | null
    formats: FormatTag[]
    categories: CategoryTag[]
}

export interface ArticleDetail extends ArticleSummary {
    body: string | null
    excerpt: string | null
    seoDescription: string | null
    heroAssetId: number | null
    requiredLevelSortOrder: number | null
    scheduledAt: string | null
    categories: CategoryTag[]
}

export interface SeriesSummary {
    id: number
    slug: string
    title: string
    status: SeriesStatus
    rssUrl: string | null
}

export interface SeriesDetail {
    id: number
    slug: string
    title: string
    description: string | null
    coverAssetId: number | null
    language: string | null
    itunesCategory: string | null
    itunesExplicit: boolean
    defaultRequiredLevelSortOrder: number | null
    rssUrl: string | null
    status: SeriesStatus
}

export interface CreateArticleInput {
    slug: string
    title: string
    body?: string
    excerpt?: string
    seoDescription?: string
    accessPolicy: AccessPolicy
    heroAssetId?: number
    requiredLevelSortOrder?: number
}

export interface UpdateArticleInput {
    slug?: string
    title?: string
    body?: string
    excerpt?: string
    seoDescription?: string
    accessPolicy?: AccessPolicy
    heroAssetId?: number
    clearHeroAsset?: boolean
    requiredLevelSortOrder?: number
}

export interface CreateEpisodeInput {
    seriesId: number
    slug: string
    title: string
    description?: string
    accessPolicy: AccessPolicy
    episodeNumber?: number
    requiredLevelSortOrder?: number
    coverAssetId?: number
}

export interface UpdateEpisodeInput {
    slug?: string
    title?: string
    description?: string
    accessPolicy?: AccessPolicy
    episodeNumber?: number
    requiredLevelSortOrder?: number
    coverAssetId?: number
    clearCoverAsset?: boolean
}

export interface CreateSeriesInput {
    slug: string
    title: string
    description?: string
    coverAssetId?: number
    language?: string
    itunesCategory?: string
    itunesExplicit?: boolean
    defaultRequiredLevelSortOrder?: number
}

export interface UpdateSeriesInput {
    slug?: string
    title?: string
    description?: string
    coverAssetId?: number
    language?: string
    itunesCategory?: string
    itunesExplicit?: boolean
    defaultRequiredLevelSortOrder?: number
    status?: SeriesStatus
}

export interface RssImportChannel {
    title: string
    description: string | null
    language: string | null
    itunesCategory: string | null
    imageUrl: string | null
    link: string | null
    suggestedSlug: string
}

export interface RssImportEpisodePreview {
    guid: string
    title: string
    description: string | null
    publishedAt: string | null
    durationSeconds: number | null
    episodeNumber: number | null
    audioUrl: string | null
    audioMimeType: string | null
    audioSizeBytes: number | null
    imageUrl: string | null
    suggestedSlug: string
    alreadyImportedEpisodeId: number | null
}

export interface RssImportPreview {
    feedUrl: string
    channel: RssImportChannel
    episodes: RssImportEpisodePreview[]
    truncated: boolean
}

export interface ImportEpisodeInput {
    seriesId: number
    feedUrl: string
    guid: string
    slug?: string
    title: string
    description?: string
    episodeNumber?: number
    durationSeconds?: number
    accessPolicy?: AccessPolicy
    requiredLevelSortOrder?: number
    formatIds?: number[]
    categoryIds?: number[]
    audioUrl?: string
    imageUrl?: string
    audioAssetId?: number
    coverAssetId?: number
    /** Original RSS pubDate; preserved when the episode is published. */
    publishedAt?: string
}

export interface ImportedEpisodeResult {
    episode: EpisodeDetail
    alreadyImported: boolean
}

export interface IngestRemoteAssetInput {
    sourceUrl: string
    assetType: AssetType
    visibility?: AssetVisibility
    filename?: string
    /** When false, returns a pending asset immediately and streams in the background. */
    waitForCompletion?: boolean
}

export interface PublishOptions {
    notifySubscribers?: boolean
    /** ISO instant; omit or leave empty in the UI to publish with the current time. */
    publishedAt?: string
}

export interface ScheduleOptions {
    scheduledAt: string
    notifySubscribers?: boolean
}

// ---------------------------------------------------------------------------
// Media assets
// ---------------------------------------------------------------------------


export interface MediaAsset {
    id: number
    s3Key: string
    visibility: string
    scope: string
    assetType: AssetType | string
    status: AssetStatus | string
    mimeType: string | null
    sizeBytes: number | null
    /** Bytes streamed so far during remote ingest; omitted on older responses. */
    bytesTransferred?: number
    originalFilename: string | null
    episodeId: number | null
    ownerUserId: number | null
    /** Media library folder; null means the library root. */
    folderId: number | null
    /** CDN URL for READY PUBLIC assets; null for private or non-ready. */
    cdnUrl: string | null
    createdAt: string
    updatedAt: string
}

/** Presigned upload target from POST /api/v1/media/upload-url. */
export interface UploadUrlResponse {
    assetId: number
    uploadUrl: string
    expiresAt: string | null
    headers: Record<string, string> | null
}

export interface TenantMediaList {
    content: MediaAsset[]
    /** CDN origin from Directwerk storage config; used to derive links if needed. */
    publicCdnBaseUrl?: string | null
}

export interface TenantMediaQuery {
    assetType?: AssetType
    status?: AssetStatus
    limit?: number
    /** Exact-folder filter; omit for all folders. */
    folderId?: number
    /** Include descendants of folderId. */
    recursive?: boolean
    /** Only root-level (unassigned) assets; mutually exclusive with folderId. */
    unassignedOnly?: boolean
}

/** User-facing folder in the media library. Null parentId means the library root. */
export interface MediaFolder {
    id: number
    name: string
    parentId: number | null
    createdAt: string
    updatedAt: string
}

// ---------------------------------------------------------------------------
// Site configuration
// ---------------------------------------------------------------------------

/** Public site configuration served to anonymous visitors. */
export interface SiteAnalytics {
    umamiWebsiteId: string
    umamiHostUrl: string
    umamiScriptUrl: string
}

/** Public site configuration served to anonymous visitors. */
export interface PublicSiteConfig {
    tenant: {slug: string; name: string}
    enabledModules: string[]
    branding: {
        siteTitle: string | null
        primaryColor: string | null
        secondaryColor: string | null
        logoUrl: string | null
    }
    publicRssUrl: string | null
    publicArticleRssUrl: string | null
    publicSiteUrl: string | null
    /** Umami analytics when the ANALYTICS module is enabled and configured. */
    analytics: SiteAnalytics | null
    /** True when the tenant has EMAIL_NOTIFY and platform email delivery is enabled. */
    emailNotifyAvailable: boolean
}

/**
 * Site configuration as consumed by the creator dashboard. Extends the
 * public shape with the studio-specific desk configuration returned by the
 * same `/api/v1/public/site-config` endpoint.
 */
export interface SiteConfig extends PublicSiteConfig {
    studioHome: StudioHome
    studioDesks: StudioDesk[]
}

// ---------------------------------------------------------------------------
// Formats / categories / levels
// ---------------------------------------------------------------------------

/** Tenant-scoped format view (includes the `active` flag). */
export interface FormatSummary {
    id: number
    slug: string
    name: string
    active: boolean
    description: string | null
    requiredLevelSortOrder: number | null
    sortOrder: number
    coverAssetId: number | null
}

/** Public format view (no `active` flag). */
export interface PublicFormat {
    id: number
    slug: string
    name: string
    description: string | null
    requiredLevelSortOrder: number | null
    sortOrder: number
}

/** Format projection embedded in subscriber feeds. */
export interface FeedFormat {
    id: number
    slug: string
    name: string
    requiredLevelSortOrder: number | null
    sortOrder: number
}

export interface CategorySummary {
    id: number
    slug: string
    name: string
    parentId: number | null
    active: boolean
}

export interface PublicCategory {
    id: number
    slug: string
    name: string
    parentId: number | null
}

/** Subscription level summary; identical projection to the web `AccessLevel`. */
export interface LevelSummary {
    id: number
    slug: string
    title: string
    sortOrder: number
}


export interface CreateFormatInput {
    slug: string
    name: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
    coverAssetId?: number
}

export interface UpdateFormatInput {
    name?: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
    active?: boolean
    coverAssetId?: number
}

export interface CreateCategoryInput {
    slug: string
    name: string
    parentId?: number
}

export interface UpdateCategoryInput {
    name?: string
    parentId?: number
    active?: boolean
}

// ---------------------------------------------------------------------------
// Subscriptions / billing
// ---------------------------------------------------------------------------

export type OfferingType = 'LEVEL' | 'PACKAGE'

export type BillingInterval = 'MONTH' | 'YEAR' | 'ONE_TIME'

export type ProductAccessScopeType =
    | 'ALL_PODCASTS'
    | 'PODCAST_SERIES'
    | 'FORMAT'
    | 'CATEGORY'
    | 'DIGITAL_ASSET'
    | 'FEED_BUILDER'

export interface SubscriptionProduct {
    id: number
    slug: string
    title: string
    offeringType: OfferingType
    sortOrder: number
    active: boolean
    description: string | null
    priceCents: number | null
    currency: string
    billingInterval: BillingInterval
    stripeProductId: string | null
    stripePriceId: string | null
}

export interface ProductAccessRule {
    id: number
    productId: number
    scopeType: ProductAccessScopeType
    scopeId: number | null
    effect: string
    createdAt: string
}

export interface ProductAccessRuleInput {
    scopeType: ProductAccessScopeType
    scopeId?: number | null
}

export interface CreateProductInput {
    slug: string
    title: string
    sortOrder?: number
    offeringType?: OfferingType
    description?: string
    priceCents?: number
    currency?: string
    billingInterval?: BillingInterval
}

export interface UpdateProductInput {
    title?: string
    sortOrder?: number
    active?: boolean
    description?: string
    priceCents?: number
    currency?: string
    billingInterval?: BillingInterval
}

export interface SubscriptionGrant {
    id: number
    userId: number
    email: string
    productId: number
    productSlug: string
    productTitle: string
    status: string
    source: string
}

export interface GrantSubscriptionInput {
    email: string
    productId: number
}

/** Subscriber's own subscription rows from GET /api/v1/me/subscriptions. */
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

export interface StripeStatus {
    status: string
    moduleEnabled: boolean
    message: string
    chargesEnabled: boolean
    payoutsEnabled: boolean
    detailsSubmitted: boolean
}

export interface BillingStats {
    activeSubscriptions: number
    activePaidSubscriptions: number
    activeGrantSubscriptions: number
    uniqueActiveMembers: number
    newThisMonth: number
    canceledThisMonth: number
    pastDueSubscriptions: number
    incompleteSubscriptions: number
    totalMemberships: number
    estimatedMonthlyCents: number
    currency: string
}

export interface BillingMembership {
    id: number
    userId: number
    email: string
    productId: number
    productSlug: string
    productTitle: string
    status: string
    source: string
    startedAt: string | null
    endsAt: string | null
    externalSubscriptionId: string | null
}

export interface BillingDashboard {
    stripe: StripeStatus
    stats: BillingStats
    memberships: BillingMembership[]
}

// ---------------------------------------------------------------------------
// Subscriber access / feeds / downloads (web)
// ---------------------------------------------------------------------------

export interface PackageSummary {
    id: number
    slug: string
    title: string
}

export interface Access {
    activeLevels: LevelSummary[]
    maxLevelSortOrder: number | null
    activePackages: PackageSummary[]
    roles: string[]
    tenantId: number
}


export interface SubscriberFeedView {
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


export interface FeedPreview {
    episodeCount: number
    sampleTitles: string[]
}

export interface ArticleFeedView {
    id: number
    title: string
    isDefault: boolean
    enabled: boolean
    url: string
    categoryIds: number[]
    categories: PublicCategory[]
    createdAt: string
    updatedAt: string
}

export interface ArticleFeedAdminView {
    id: number
    userId: number
    userEmail: string
    title: string
    isDefault: boolean
    enabled: boolean
    categoryIds: number[]
    categories: PublicCategory[]
    createdAt: string
    updatedAt: string
}

export interface ArticleFeedPreview {
    articleCount: number
    sampleTitles: string[]
}

/** Entitled bonus file from GET /api/v1/me/downloads. */
export interface SubscriberDownload {
    id: number
    title: string
    assetType: string
    mimeType: string | null
    sizeBytes: number | null
    downloadUrl: string
}

// ---------------------------------------------------------------------------
// Public content (web)
// ---------------------------------------------------------------------------

/** Public product listing from GET /api/v1/public/products. */
export interface PublicProduct {
    slug: string
    title: string
    offeringType: OfferingType
    sortOrder: number
    description: string | null
    priceCents: number | null
    currency: string
    billingInterval: BillingInterval
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
    rssUrl: string | null
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

// ---------------------------------------------------------------------------
// Tenant administration
// ---------------------------------------------------------------------------

export interface TenantBranding {
    siteTitle: string | null
    primaryColor: string | null
    secondaryColor: string | null
    logoUrl: string | null
    umamiWebsiteId: string | null
    umamiHostUrl: string | null
}

export interface UpdateTenantBrandingInput {
    siteTitle?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    logoUrl?: string | null
    umamiWebsiteId?: string | null
    umamiHostUrl?: string | null
}

export interface TenantSubscriber {
    userId: number
    email: string
    name: string | null
    status: string
    subscriptions: TenantSubscriberSubscription[]
}

export interface TenantSubscriberSubscription {
    id: number
    productId: number
    productSlug: string
    productTitle: string
    status: string
    source: string
    startedAt: string | null
    endsAt: string | null
    externalSubscriptionId: string | null
}

export type ContentEmailTemplateType = 'EPISODE' | 'ARTICLE'

export interface ContentEmailTemplate {
    contentType: ContentEmailTemplateType
    subjectTemplate: string
    bodyHtml: string
    updatedAt: string | null
}

export interface UpsertContentEmailTemplateInput {
    subjectTemplate: string
    bodyHtml: string
}

export interface TenantDomain {
    host: string
    primary: boolean
    verified: boolean
}

export interface AddTenantDomainInput {
    host: string
    isPrimary?: boolean
}

export interface DomainVerificationChallenge {
    host: string
    token: string
    dnsTxtValue: string
    dnsNameHint: string
}

export interface TenantUser {
    userId: number
    email: string
    name: string | null
    roles: string[]
    status: MembershipStatus
    invitedAt: string | null
    lastLoginAt: string | null
}

export interface TenantUsers {
    content: TenantUser[]
}

export interface InviteTenantUserInput {
    email: string
    name?: string
    role: TenantInvitableRole
}

export interface InviteTenantUserResponse {
    email: string
    role: string
    status: string
    inviteToken: string | null
}

/** Tenant-admin feed listing; owner identity instead of feed URL. */
export interface SubscriberFeedAdminView {
    id: number
    userId: number
    userEmail: string
    title: string
    isDefault: boolean
    enabled: boolean
    formatIds: number[]
    formats: FormatTag[]
    createdAt: string
    updatedAt: string
}


// ---------------------------------------------------------------------------
// Platform administration (directwerk-admin)
// ---------------------------------------------------------------------------

export interface Tenant {
    id: number
    slug: string
    name: string
    status: string
    createdAt?: string
    primaryDomain?: string | null
}

export interface TenantDomainSummary {
    host: string
    primary: boolean
    verified: boolean
}

export interface TenantDetail {
    id: number
    slug: string
    name: string
    status: string
    createdAt: string
    primaryDomain: string | null
    domains: TenantDomainSummary[]
}

export interface TenantDetailResponse {
    tenant: TenantDetail
    episodeCount: number
    subscriberCount: number
}

export interface PlatformBranding {
    siteTitle: string | null
    umamiWebsiteId: string | null
    umamiHostUrl: string | null
}

export interface TenantList {
    content: Tenant[]
}

export interface TenantModuleActivation {
    moduleKey: string
    active: boolean
    activatedAt: string
    source: string
}

export interface TenantModules {
    enabledModules: string[]
    activations: TenantModuleActivation[]
}
export interface TenantAdminInvitation {
    email: string
    status: string
    inviteToken: string | null
}

export interface TenantCreationResponse {
    id: number
    slug: string
    name: string
    status: string
    adminInvitation: TenantAdminInvitation | null
}

export interface CreateTenantInput {
    name: string
    slug: string
    primaryDomain?: string
    modulePreset?: string
    adminEmail?: string
    adminName?: string
}

/** Platform module catalog entry from GET /api/v1/platform/modules */
export interface ModuleDescriptor {
    moduleKey: string
    name: string
    description: string | null
    dependsOn: string[]
    core: boolean
}

export type ModulePresetKey = (typeof MODULE_PRESETS)[number]

export interface PlatformAdmin {
    userId: number
    email: string
    name: string | null
    lastLoginAt: string | null
}

export interface InvitePlatformAdminResponse {
    userId: number
    email: string
    name: string | null
    status: string
    inviteToken: string | null
}

export interface QueueJob {
    id: string
    queue: string
    payload: unknown
    priority: number
    status: JobStatus
    availableAt: string
    attempts: number
    maxAttempts: number
    lockedBy: string | null
    lockedUntil: string | null
    lastError: string | null
    createdAt: string
    updatedAt: string
}

export interface PlatformAuditEvent {
    id: number
    action: string
    actorUserId: number | null
    actorEmail: string | null
    tenantId: number | null
    details: Record<string, unknown>
    createdAt: string
}

export interface PlatformAuditPage {
    content: PlatformAuditEvent[]
    totalElements: number
    page: number
    size: number
}

export interface PlatformOverview {
    tenantCounts: {
        active: number
        suspended: number
    }
    moduleAdoption: Array<{
        moduleKey: string
        tenantCount: number
    }>
    recentAudit: PlatformAuditEvent[]
}

export interface PlatformAuditQuery {
    page?: number
    size?: number
    tenantId?: number
    action?: string
    actorEmail?: string
}

// ---------------------------------------------------------------------------
// Value re-exports (compatibility): the canonical home of these constants is
// `@directwerk/api/constants`; they are re-exported here because they are
// inseparable from their DTO types at most call sites.
// ---------------------------------------------------------------------------

export {
    ASSET_STATUSES,
    ASSET_TYPES,
    ASSET_VISIBILITIES,
    JOB_STATUSES,
    MODULE_PRESETS,
    PLATFORM_TENANT_INVITABLE_ROLES,
    TENANT_INVITABLE_ROLES,
} from './constants'
export type {TenantInvitableRole} from './constants'


export interface JobListPage {
    items: QueueJob[]
    total: number
    offset: number
    limit: number
}

export interface JobListQuery {
    queue?: string
    status?: JobStatus
    updatedAfter?: string
    updatedBefore?: string
    offset?: number
    limit?: number
}
