'use client'

import {parseMediaAssetEnvelope, parseMediaListEnvelope, parsePreviewUrlEnvelope} from '@directwerk/api/validation/catalog'

import type {MediaAsset} from '@directwerk/api/types'
import {authenticatedRequest, studioGet, studioMutate} from './studioApiCore'

const invalidMediaMessage = 'Der Server hat ein ungültiges Medium gesendet.'

export async function confirmUpload(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}/confirm`,
        tenantHost,
        {method: 'POST'},
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function listMedia(tenantHost: string): Promise<MediaAsset[]> {
    return studioGet(
        '/api/proxy/media',
        tenantHost,
        parseMediaListEnvelope,
        'Der Server hat eine ungültige Medienliste gesendet.',
    )
}

export async function getMedia(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return studioGet(
        `/api/proxy/media/${assetId}`,
        tenantHost,
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function deleteMedia(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}`,
        tenantHost,
        {method: 'DELETE'},
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function getMediaPreviewUrl(
    tenantHost: string,
    assetId: number,
): Promise<string> {
    const url = parsePreviewUrlEnvelope(
        await authenticatedRequest(
            `/api/proxy/media/${assetId}/preview-url`,
            tenantHost,
        ),
    )
    if (url === null) {
        throw new Error('Der Server hat keine gültige Audio-Vorschau-URL gesendet.')
    }

    return url
}
