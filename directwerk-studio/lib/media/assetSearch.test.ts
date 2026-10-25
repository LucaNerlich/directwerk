import {describe, expect, it} from 'vitest'

import {assetLabel, matchesQuery} from '@/lib/media/assetSearch'
import type {MediaAsset} from '@directwerk/api/types'

function asset(partial: Pick<MediaAsset, 'id'> & Partial<MediaAsset>): MediaAsset {
    return {
        s3Key: 'tenant/staging/x',
        visibility: 'PUBLIC',
        scope: '',
        status: 'READY',
        assetType: 'IMAGE',
        mimeType: 'image/png',
        originalFilename: null,
        sizeBytes: 1,
        bytesTransferred: 0,
        episodeId: null,
        ownerUserId: 1,
        folderId: null,
        createdBy: null,
        cdnUrl: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...partial,
    }
}

describe('assetSearch', () => {
    it('falls back to Asset {id} when filename is missing', () => {
        expect(assetLabel(asset({id: 9, originalFilename: null}))).toBe('Asset 9')
    })

    it('matches case-insensitive substrings; empty needle matches all', () => {
        const cover = asset({id: 1, originalFilename: 'Cover-Art.PNG'})
        // Callers lower-case the needle (see MediaLibraryPicker / MediaLibraryClient).
        expect(matchesQuery(cover, '')).toBe(true)
        expect(matchesQuery(cover, 'cover')).toBe(true)
        expect(matchesQuery(cover, 'art')).toBe(true)
        expect(matchesQuery(cover, 'logo')).toBe(false)
    })
})
