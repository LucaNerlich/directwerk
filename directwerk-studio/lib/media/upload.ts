'use client'

import type {AssetType} from '@directwerk/api/types'
import {uploadMediaFileBrowser} from '@directwerk/api/media/browserUpload'
import {confirmUpload} from '@/lib/api/mediaApi'
import {getValidAccessToken} from '@/lib/auth/session'
import {clearTokens} from '@/lib/auth/tokenStore'
import {
    exceedsMediaLimitFor,
    mediaLimitLabelFor,
    MEDIA_TYPE_LIMITS,
    type ResolvedMediaLimits,
} from '@/lib/media/limits'

/**
 * Uploads a media file for a tenant.
 *
 * @param tenantHost - The tenant host associated with the upload
 * @param file - The media file to upload
 * @param options - Optional upload settings, including asset type, visibility, destination IDs, media limits, and progress reporting
 * @returns The result of the completed media upload
 */
export async function uploadMediaFile(
    tenantHost: string,
    file: File,
    options?: {
        assetType?: AssetType
        visibility?: 'PUBLIC' | 'PRIVATE'
        episodeId?: number
        folderId?: number
        /** Effective tenant limits; defaults to the platform limits when omitted. */
        limits?: ResolvedMediaLimits
        onProgress?: (percent: number) => void
    },
) {
    const limits = options?.limits ?? MEDIA_TYPE_LIMITS
    return uploadMediaFileBrowser({
        tenantHost,
        file,
        assetType: options?.assetType,
        visibility: options?.visibility,
        episodeId: options?.episodeId,
        folderId: options?.folderId,
        onProgress: options?.onProgress,
        getAccessToken: getValidAccessToken,
        onAuthRequired: clearTokens,
        confirmUpload,
        exceedsLimit: (assetType, size) => exceedsMediaLimitFor(limits, assetType, size),
        limitLabel: (assetType) => mediaLimitLabelFor(limits, assetType),
    })
}
