'use client'

import {parseMediaAssetEnvelope, parseMediaFolderEnvelope, parseMediaFolderListEnvelope, parseMediaListEnvelope, parseMediaStorageSummaryEnvelope, parseMediaUploadLimitsEnvelope, parsePreviewUrlEnvelope} from '@directwerk/api/validation/catalog'

import type {MediaAsset, MediaFolder, MediaStorageSummary, MediaUploadLimits, TenantMediaQuery} from '@directwerk/api/types'
import {authenticatedRequest, studioGet, studioMutate} from './studioApiCore'
import {jsonInit} from './studioTransport'

const invalidMediaMessage = 'Der Server hat ein ungültiges Medium gesendet.'
const invalidFolderMessage = 'Der Server hat einen ungültigen Ordner gesendet.'

function mediaQueryString(query?: TenantMediaQuery): string {
    if (query === undefined) {
        return ''
    }
    const params = new URLSearchParams()
    if (query.assetType !== undefined) {
        params.set('assetType', query.assetType)
    }
    if (query.status !== undefined) {
        params.set('status', query.status)
    }
    if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
    }
    if (query.offset !== undefined) {
        params.set('offset', String(query.offset))
    }
    if (query.folderId !== undefined) {
        params.set('folderId', String(query.folderId))
    }
    if (query.recursive === true) {
        params.set('recursive', 'true')
    }
    if (query.unassignedOnly === true) {
        params.set('unassignedOnly', 'true')
    }
    if (query.unreferencedOnly === true) {
        params.set('unreferencedOnly', 'true')
    }
    const serialized = params.toString()
    return serialized.length > 0 ? `?${serialized}` : ''
}

export async function confirmUpload(
        assetId: number,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}/confirm`,
        
        {method: 'POST'},
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function listMedia( query?: TenantMediaQuery): Promise<MediaAsset[]> {
    return studioGet(
        `/api/proxy/media${mediaQueryString(query)}`,
        
        parseMediaListEnvelope,
        'Der Server hat eine ungültige Medienliste gesendet.',
    )
}

export async function getMedia(
        assetId: number,
): Promise<MediaAsset> {
    return studioGet(
        `/api/proxy/media/${assetId}`,
        
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function deleteMedia(
        assetId: number,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}`,
        
        {method: 'DELETE'},
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function moveMediaAsset(
        assetId: number,
    folderId: number | null,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}/move`,
        
        jsonInit('POST', {folderId}),
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function renameMediaAsset(
        assetId: number,
    filename: string,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}`,
        
        jsonInit('PUT', {filename}),
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function listMediaFolders(): Promise<MediaFolder[]> {
    return studioGet(
        '/api/proxy/media/folders',
        
        parseMediaFolderListEnvelope,
        'Der Server hat eine ungültige Ordnerliste gesendet.',
    )
}

export async function getMediaUploadLimits(): Promise<MediaUploadLimits> {
    return studioGet(
        '/api/proxy/media/limits',
        
        parseMediaUploadLimitsEnvelope,
        'Der Server hat ungültige Upload-Limits gesendet.',
    )
}

export async function getStorageSummary(
    ): Promise<MediaStorageSummary> {
    return studioGet(
        '/api/proxy/media/storage-summary',
        
        parseMediaStorageSummaryEnvelope,
        'Der Server hat eine ungültige Speicher-Zusammenfassung gesendet.',
    )
}

export async function createMediaFolder(
        name: string,
    parentId: number | null,
): Promise<MediaFolder> {
    return studioMutate(
        '/api/proxy/media/folders',
        
        jsonInit('POST', {name, parentId}),
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export async function renameMediaFolder(
        folderId: number,
    name: string,
): Promise<MediaFolder> {
    return studioMutate(
        `/api/proxy/media/folders/${folderId}`,
        
        jsonInit('PUT', {name}),
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export async function moveMediaFolder(
        folderId: number,
    parentId: number | null,
): Promise<MediaFolder> {
    return studioMutate(
        `/api/proxy/media/folders/${folderId}/move`,
        
        jsonInit('POST', {parentId}),
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export type MediaFolderDeleteMode = 'move_to_parent' | 'delete_contents'

export async function deleteMediaFolder(
        folderId: number,
    mode: MediaFolderDeleteMode,
): Promise<MediaFolder> {
    return studioMutate(
        `/api/proxy/media/folders/${folderId}?mode=${mode}`,
        
        {method: 'DELETE'},
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export async function getMediaPreviewUrl(
        assetId: number,
): Promise<string> {
    const url = parsePreviewUrlEnvelope(
        await authenticatedRequest(
            `/api/proxy/media/${assetId}/preview-url`,
            '',
        ),
    )
    if (url === null) {
        throw new Error('Der Server hat keine gültige Audio-Vorschau-URL gesendet.')
    }

    return url
}
