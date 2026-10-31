import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {EpisodeSummary} from '@directwerk/api/types'

const listEpisodes = vi.fn()

vi.mock('@/lib/api/podcastApi', () => ({
    listEpisodes: (...args: unknown[]) => listEpisodes(...args),
}))

import {listAllEpisodes} from '@/lib/api/listAllEpisodes'

function episode(id: number, status: EpisodeSummary['status'] = 'DRAFT'): EpisodeSummary {
    return {
        id,
        slug: `ep-${id}`,
        title: `Episode ${id}`,
        status,
        accessPolicy: 'FREE',
        publishedAt: null,
    } as EpisodeSummary
}

describe('listAllEpisodes (#953)', () => {
    beforeEach(() => {
        listEpisodes.mockReset()
    })

    it('walks pages so episodes past the first page are included', async () => {
        const firstPage = Array.from({length: 100}, (_, index) => episode(index + 1))
        const secondPage = [episode(101, 'PUBLISHED'), episode(102)]
        listEpisodes.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)

        await expect(listAllEpisodes()).resolves.toEqual([...firstPage, ...secondPage])
        expect(listEpisodes).toHaveBeenCalledTimes(2)
        expect(listEpisodes).toHaveBeenNthCalledWith(1, {limit: 100, offset: 0})
        expect(listEpisodes).toHaveBeenNthCalledWith(2, {limit: 100, offset: 100})
    })

    it('stops after a short first page', async () => {
        listEpisodes.mockResolvedValueOnce([episode(1)])

        await expect(listAllEpisodes()).resolves.toEqual([episode(1)])
        expect(listEpisodes).toHaveBeenCalledTimes(1)
        expect(listEpisodes).toHaveBeenCalledWith({limit: 100, offset: 0})
    })
})
