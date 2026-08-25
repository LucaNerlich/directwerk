export type StudioHome = 'OVERVIEW' | 'WRITE_DESK' | 'PODCAST_DESK'

export type StudioDesk = 'WRITE' | 'PODCAST'

export type PublicationStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'

export type AccessPolicy = 'FREE' | 'PAID'

export interface ApiEnvelope<T> {
    statusCode: number
    statusMessage: string
    data: T
    errors: Array<{code: string; message: string; field: string | null}>
    metadata: Record<string, unknown>
}

export interface Tag {
    id: number
    slug: string
    name: string
}

export type FormatTag = Tag
export type CategoryTag = Tag

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

export interface SiteConfig {
    tenant: {slug: string; name: string}
    enabledModules: string[]
    branding: {
        siteTitle: string | null
        primaryColor: string | null
        secondaryColor: string | null
        logoUrl: string | null
    }
    publicRssUrl: string | null
    studioHome: StudioHome
    studioDesks: StudioDesk[]
    emailNotifyAvailable: boolean
}

export interface EpisodeSummary {
    id: number
    slug: string
    title: string
    status: PublicationStatus
    accessPolicy: AccessPolicy
    publishedAt: string | null
}

export interface ArticleSummary {
    id: number
    slug: string
    title: string
    status: PublicationStatus
    accessPolicy: AccessPolicy
    publishedAt: string | null
}

export interface EpisodeDetail extends EpisodeSummary {
    seriesId: number
    seriesSlug: string | null
    description: string | null
    episodeNumber: number | null
    audioAssetId: number | null
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

export type SeriesStatus = 'DRAFT' | 'PUBLISHED'

export interface SeriesDetail {
    id: number
    slug: string
    title: string
    description: string | null
    coverAssetId: number | null
    language: string | null
    itunesCategory: string | null
    defaultRequiredLevelSortOrder: number | null
    rssUrl: string | null
    status: SeriesStatus
}

export interface CreateArticleInput {
    slug: string
    title: string
    body?: string
    excerpt?: string
    accessPolicy: AccessPolicy
    heroAssetId?: number
    requiredLevelSortOrder?: number
}

export interface UpdateArticleInput {
    slug?: string
    title?: string
    body?: string
    excerpt?: string
    accessPolicy?: AccessPolicy
    heroAssetId?: number
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
}

export interface UpdateEpisodeInput {
    slug?: string
    title?: string
    description?: string
    accessPolicy?: AccessPolicy
    episodeNumber?: number
    requiredLevelSortOrder?: number
}

export interface CreateSeriesInput {
    slug: string
    title: string
    description?: string
    coverAssetId?: number
    language?: string
    itunesCategory?: string
    defaultRequiredLevelSortOrder?: number
}

export interface UpdateSeriesInput {
    slug?: string
    title?: string
    description?: string
    coverAssetId?: number
    language?: string
    itunesCategory?: string
    defaultRequiredLevelSortOrder?: number
    status?: SeriesStatus
}

export interface PublishOptions {
    notifySubscribers?: boolean
}

export interface ScheduleOptions {
    scheduledAt: string
    notifySubscribers?: boolean
}

export type AssetType = 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export interface MediaAsset {
    id: number
    status: string
    assetType: string
    mimeType: string | null
    originalFilename: string | null
    sizeBytes: number | null
    visibility?: string | null
    scope?: string | null
    cdnUrl?: string | null
    createdAt?: string | null
}

export interface LevelSummary {
    id: number
    slug: string
    title: string
    sortOrder: number
}

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

export interface CreateFormatInput {
    slug: string
    name: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
}

export interface UpdateFormatInput {
    name?: string
    description?: string
    requiredLevelSortOrder?: number
    sortOrder?: number
    active?: boolean
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

export interface ProductAccessRuleInput {
    scopeType: ProductAccessScopeType
    scopeId?: number | null
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

export interface FormatSummary {
    id: number
    slug: string
    name: string
    active: boolean
    description: string | null
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

export interface TenantBranding {
    siteTitle: string | null
    primaryColor: string | null
    secondaryColor: string | null
    logoUrl: string | null
    umamiWebsiteId: string | null
}

export interface UpdateTenantBrandingInput {
    siteTitle?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    logoUrl?: string | null
    umamiWebsiteId?: string | null
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

export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'DISABLED'

export type TenantInvitableRole = 'TENANT_ADMIN' | 'EDITOR'

export const TENANT_INVITABLE_ROLES = ['TENANT_ADMIN', 'EDITOR'] as const

export interface TenantUser {
    userId: number
    email: string
    name: string | null
    roles: string[]
    status: MembershipStatus
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

export interface SubscriberFeedSummary {
    id: number
    userId: number
    userEmail: string
    title: string
    isDefault: boolean
    enabled: boolean
    formatIds: number[]
    formats: {id: number; slug: string; name: string}[]
    createdAt: string
    updatedAt: string
}
