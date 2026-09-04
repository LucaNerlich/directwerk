'use client'

import type {AssetType} from '@directwerk/api/types'
import {uploadMediaFileBrowser} from '@directwerk/api/media/browserUpload'
import {confirmUpload} from '@/lib/api/mediaApi'
import {getValidAccessToken} from '@/lib/auth/session'
import {clearTokens} from '@/lib/auth/tokenStore'
import {exceedsMediaLimit, mediaLimitLabel} from '@/lib/media/limits'

export async function uploadMediaFile(
    tenantHost: string,
    file: File,
    options?: {
        assetType?: AssetType
        visibility?: 'PUBLIC' | 'PRIVATE'
        episodeId?: number
        folderId?: number
        onProgress?: (percent: number) => void
    },
) {
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
        exceedsLimit: exceedsMediaLimit,
        limitLabel: mediaLimitLabel,
    })
}
