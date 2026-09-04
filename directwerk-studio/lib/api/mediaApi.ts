'use client'

import {parseMediaAssetEnvelope, parseMediaFolderEnvelope, parseMediaFolderListEnvelope, parseMediaListEnvelope, parsePreviewUrlEnvelope} from '@directwerk/api/validation/catalog'

import type {MediaAsset, MediaFolder, TenantMediaQuery} from '@directwerk/api/types'
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
    if (query.folderId !== undefined) {
        params.set('folderId', String(query.folderId))
    }
    if (query.recursive === true) {
        params.set('recursive', 'true')
    }
    if (query.unassignedOnly === true) {
        params.set('unassignedOnly', 'true')
    }
    const serialized = params.toString()
    return serialized.length > 0 ? `?${serialized}` : ''
}

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

export async function listMedia(tenantHost: string, query?: TenantMediaQuery): Promise<MediaAsset[]> {
    return studioGet(
        `/api/proxy/media${mediaQueryString(query)}`,
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

export async function moveMediaAsset(
    tenantHost: string,
    assetId: number,
    folderId: number | null,
): Promise<MediaAsset> {
    return studioMutate(
        `/api/proxy/media/${assetId}/move`,
        tenantHost,
        jsonInit('POST', {folderId}),
        parseMediaAssetEnvelope,
        invalidMediaMessage,
    )
}

export async function listMediaFolders(tenantHost: string): Promise<MediaFolder[]> {
    return studioGet(
        '/api/proxy/media/folders',
        tenantHost,
        parseMediaFolderListEnvelope,
        'Der Server hat eine ungültige Ordnerliste gesendet.',
    )
}

export async function createMediaFolder(
    tenantHost: string,
    name: string,
    parentId: number | null,
): Promise<MediaFolder> {
    return studioMutate(
        '/api/proxy/media/folders',
        tenantHost,
        jsonInit('POST', {name, parentId}),
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export async function renameMediaFolder(
    tenantHost: string,
    folderId: number,
    name: string,
): Promise<MediaFolder> {
    return studioMutate(
        `/api/proxy/media/folders/${folderId}`,
        tenantHost,
        jsonInit('PUT', {name}),
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export async function moveMediaFolder(
    tenantHost: string,
    folderId: number,
    parentId: number | null,
): Promise<MediaFolder> {
    return studioMutate(
        `/api/proxy/media/folders/${folderId}/move`,
        tenantHost,
        jsonInit('POST', {parentId}),
        parseMediaFolderEnvelope,
        invalidFolderMessage,
    )
}

export type MediaFolderDeleteMode = 'move_to_parent' | 'delete_contents'

export async function deleteMediaFolder(
    tenantHost: string,
    folderId: number,
    mode: MediaFolderDeleteMode,
): Promise<MediaFolder> {
    return studioMutate(
        `/api/proxy/media/folders/${folderId}?mode=${mode}`,
        tenantHost,
        {method: 'DELETE'},
        parseMediaFolderEnvelope,
        invalidFolderMessage,
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
