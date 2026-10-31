import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {ArticleSummary} from '@directwerk/api/types'

const listArticles = vi.fn()

vi.mock('@/lib/api/writeApi', () => ({
    listArticles: (...args: unknown[]) => listArticles(...args),
}))

import {listAllArticles} from '@/lib/api/listAllArticles'

function article(id: number, status: ArticleSummary['status'] = 'DRAFT'): ArticleSummary {
    return {
        id,
        slug: `slug-${id}`,
        title: `Article ${id}`,
        status,
        accessPolicy: 'FREE',
        publishedAt: null,
    } as ArticleSummary
}

describe('listAllArticles (#953)', () => {
    beforeEach(() => {
        listArticles.mockReset()
    })

    it('walks pages so articles past the first page are included', async () => {
        const firstPage = Array.from({length: 100}, (_, index) => article(index + 1))
        const secondPage = [article(101, 'PUBLISHED'), article(102)]
        listArticles.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)

        await expect(listAllArticles()).resolves.toEqual([...firstPage, ...secondPage])
        expect(listArticles).toHaveBeenCalledTimes(2)
        expect(listArticles).toHaveBeenNthCalledWith(1, {limit: 100, offset: 0})
        expect(listArticles).toHaveBeenNthCalledWith(2, {limit: 100, offset: 100})
    })

    it('stops after a short first page', async () => {
        listArticles.mockResolvedValueOnce([article(1)])

        await expect(listAllArticles()).resolves.toEqual([article(1)])
        expect(listArticles).toHaveBeenCalledTimes(1)
        expect(listArticles).toHaveBeenCalledWith({limit: 100, offset: 0})
    })
})
