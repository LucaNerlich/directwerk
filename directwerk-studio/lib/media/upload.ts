'use client'

import type {AssetType} from '@directwerk/api/types'
import {uploadMediaFileBrowser} from '@directwerk/api/media/browserUpload'
import {confirmUpload} from '@/lib/api/mediaApi'
import {getValidAccessToken} from '@/lib/auth/session'
import {clearTokens} from '@/lib/auth/tokenStore'
import {
    exceedsMediaLimit,
    exceedsMediaLimitFor,
    mediaLimitLabel,
    mediaLimitLabelFor,
    type ResolvedMediaLimits,
} from '@/lib/media/limits'

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
    const limits = options?.limits
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
        exceedsLimit:
            limits === undefined
                ? exceedsMediaLimit
                : (assetType, size) => exceedsMediaLimitFor(limits, assetType, size),
        limitLabel:
            limits === undefined
                ? mediaLimitLabel
                : (assetType) => mediaLimitLabelFor(limits, assetType),
    })
}
