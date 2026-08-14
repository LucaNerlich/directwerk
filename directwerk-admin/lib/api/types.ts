export interface ApiEnvelope<T> {
    data: T
}

export interface OAuthTokenResponse {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
}

export interface Tenant {
    id: number
    slug: string
    name: string
    status: string
}

export interface TenantList {
    content: Tenant[]
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

export interface TenantModules {
    enabledModules: string[]
}

/** Platform module catalog entry from GET /api/v1/platform/modules */
export interface ModuleDescriptor {
    moduleKey: string
    name: string
    description: string | null
    dependsOn: string[]
    core: boolean
}

/** Known presets from ModulePreset (POST …/modules/preset/{key}) */
export const MODULE_PRESETS = [
    'FREE_PODCAST',
    'WRITER',
    'PODCAST',
    'FULL',
    'PATREON_MIGRATOR',
    'PRO',
    'ENTERPRISE',
] as const

export type ModulePresetKey = (typeof MODULE_PRESETS)[number]

export interface TenantUser {
    userId: number
    email: string
    name: string | null
    roles: string[]
    status: string
}

export interface TenantUsers {
    content: TenantUser[]
}

export const ASSET_TYPES = [
    'AUDIO',
    'IMAGE',
    'VIDEO',
    'DOCUMENT',
] as const

export type AssetType = (typeof ASSET_TYPES)[number]

export const ASSET_STATUSES = [
    'PENDING',
    'READY',
    'PENDING_DELETE',
    'ARCHIVED',
] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]

export interface MediaAsset {
    id: number
    s3Key: string
    visibility: string
    scope: string
    assetType: AssetType | string
    status: AssetStatus | string
    mimeType: string | null
    sizeBytes: number | null
    originalFilename: string | null
    episodeId: number | null
    ownerUserId: number | null
    /** CDN URL for READY PUBLIC assets; null for private or non-ready. */
    cdnUrl: string | null
    createdAt: string
    updatedAt: string
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
}

export const ASSET_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const

export type AssetVisibility = (typeof ASSET_VISIBILITIES)[number]

export interface CreateUploadUrlRequest {
    filename: string
    mimeType: string
    sizeBytes: number
    assetType: AssetType
    intendedVisibility?: AssetVisibility
    scope?: string
}

export interface UploadUrlResponse {
    assetId: number
    uploadUrl: string
    expiresAt: string
    headers: Record<string, string>
}

export const TENANT_INVITABLE_ROLES = [
    'TENANT_ADMIN',
    'EDITOR',
    'SUBSCRIBER',
    'GUEST',
] as const

export type TenantInvitableRole = (typeof TENANT_INVITABLE_ROLES)[number]

export interface InviteTenantUserResponse {
    email: string
    role: string
    status: string
    inviteToken: string | null
}

export interface PlatformAdmin {
    userId: number
    email: string
    name: string | null
}

export interface InvitePlatformAdminResponse {
    userId: number
    email: string
    name: string | null
    status: string
    inviteToken: string | null
}

export const JOB_STATUSES = [
    'QUEUED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const KNOWN_JOB_QUEUES = ['email'] as const

export type KnownJobQueue = (typeof KNOWN_JOB_QUEUES)[number]

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
