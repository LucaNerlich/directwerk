import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {MediaAsset} from '@directwerk/api/types'

const listMedia = vi.fn()

vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: (...args: unknown[]) => listMedia(...args),
}))

import {listAllMedia} from '@/lib/api/listAllMedia'

function asset(id: number, assetType: MediaAsset['assetType'] = 'IMAGE'): MediaAsset {
    return {
        id,
        assetType,
        status: 'READY',
        visibility: 'PUBLIC',
        cdnUrl: `https://cdn.example.test/${id}.jpg`,
        originalFilename: `asset-${id}.jpg`,
        folderId: null,
    } as MediaAsset
}

describe('listAllMedia (#885)', () => {
    beforeEach(() => {
        listMedia.mockReset()
    })

    it('walks pages so assets past the first page are included', async () => {
        const firstPage = Array.from({length: 100}, (_, index) => asset(index + 1))
        const secondPage = [asset(101), asset(102, 'AUDIO')]
        listMedia.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)

        await expect(listAllMedia({assetType: 'IMAGE'})).resolves.toEqual([
            ...firstPage,
            ...secondPage,
        ])
        expect(listMedia).toHaveBeenCalledTimes(2)
        expect(listMedia).toHaveBeenNthCalledWith(1, {
            assetType: 'IMAGE',
            limit: 100,
            offset: 0,
        })
        expect(listMedia).toHaveBeenNthCalledWith(2, {
            assetType: 'IMAGE',
            limit: 100,
            offset: 100,
        })
    })

    it('stops after a short first page', async () => {
        listMedia.mockResolvedValueOnce([asset(1)])

        await expect(listAllMedia()).resolves.toEqual([asset(1)])
        expect(listMedia).toHaveBeenCalledTimes(1)
        expect(listMedia).toHaveBeenCalledWith({limit: 100, offset: 0})
    })
})
