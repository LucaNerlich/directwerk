import {describe, expect, it} from 'vitest'

import {assetLabel, filterAssetsByQuery, matchesQuery} from '@/lib/media/assetSearch'
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

    it('returns all assets for an empty query', () => {
        const list = [
            asset({id: 1, originalFilename: 'Cover-Art.PNG'}),
            asset({id: 2, originalFilename: 'episode-01.mp3'}),
        ]
        expect(filterAssetsByQuery(list, '')).toBe(list)
        expect(matchesQuery(list[0]!, '')).toBe(true)
    })

    it('fuzzy-matches filenames and rejects unrelated queries', () => {
        const cover = asset({id: 1, originalFilename: 'Cover-Art.PNG'})
        const list = [cover, asset({id: 2, originalFilename: 'episode-01.mp3'})]

        expect(filterAssetsByQuery(list, 'cover').map((row) => row.id)).toEqual([1])
        expect(filterAssetsByQuery(list, 'covr art').map((row) => row.id)).toEqual([1])
        expect(filterAssetsByQuery(list, 'logo')).toEqual([])
        expect(matchesQuery(cover, 'art')).toBe(true)
        expect(matchesQuery(cover, 'logo')).toBe(false)
    })
})
