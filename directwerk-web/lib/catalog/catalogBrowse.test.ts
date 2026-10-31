import {describe, expect, it} from 'vitest'

import type {PublicArticle, PublicCategory, PublicEpisode, PublicFormat} from '@directwerk/api/types'

import {
    browseArticles,
    browseEpisodes,
    collectCategories,
    collectFormats,
    groupByCategory,
    hasActiveBrowse,
    toggleId,
} from '@/lib/catalog/catalogBrowse'

function category(partial: Partial<PublicCategory> & Pick<PublicCategory, 'id' | 'slug' | 'name'>): PublicCategory {
    return {parentId: null, ...partial}
}

function format(partial: Partial<PublicFormat> & Pick<PublicFormat, 'id' | 'slug' | 'name'>): PublicFormat {
    return {
        description: null,
        requiredLevelSortOrder: null,
        sortOrder: 0,
        ...partial,
    }
}

function article(
    partial: Partial<PublicArticle> & Pick<PublicArticle, 'id' | 'slug' | 'title'>,
): PublicArticle {
    return {
        body: 'body',
        excerpt: null,
        seoDescription: null,
        heroAssetId: null,
        heroImageUrl: null,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: '2026-01-01T00:00:00Z',
        categories: [],
        ...partial,
    }
}

function episode(
    partial: Partial<PublicEpisode> & Pick<PublicEpisode, 'id' | 'slug' | 'title'>,
): PublicEpisode {
    return {
        seriesId: 1,
        seriesSlug: 'show',
        episodeNumber: 1,
        description: null,
        durationSeconds: 60,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        publishedAt: '2026-01-01T00:00:00Z',
        audioCdnUrl: 'https://cdn.example/a.mp3',
        coverImageUrl: null,
        formats: [],
        categories: [],
        ...partial,
    }
}

const lore = category({id: 1, slug: 'lore', name: 'Lore'})
const raids = category({id: 2, slug: 'raids', name: 'Raids'})
const interview = format({id: 10, slug: 'interview', name: 'Interview'})

describe('catalogBrowse', () => {
    it('collects unique category and format chips sorted by name', () => {
        const items = [
            article({id: 1, slug: 'a', title: 'A', categories: [raids, lore]}),
            article({id: 2, slug: 'b', title: 'B', categories: [lore]}),
        ]
        expect(collectCategories(items).map((t) => t.slug)).toEqual(['lore', 'raids'])

        const eps = [
            episode({id: 1, slug: 'e1', title: 'E1', formats: [interview]}),
            episode({id: 2, slug: 'e2', title: 'E2', formats: [interview]}),
        ]
        expect(collectFormats(eps)).toHaveLength(1)
    })

    it('filters articles by category then fuzzy-matches title', () => {
        const items = [
            article({id: 1, slug: 'hyjal', title: 'Mount Hyjal', categories: [raids]}),
            article({id: 2, slug: 'lore-a', title: 'Ancient Lore', categories: [lore]}),
            article({id: 3, slug: 'other', title: 'Hyjal notes', categories: [lore]}),
        ]
        const filtered = browseArticles(items, {
            query: 'hyjal',
            categoryIds: new Set([lore.id]),
        })
        expect(filtered.map((a) => a.slug)).toEqual(['other'])
    })

    it('filters episodes by format and category', () => {
        const items = [
            episode({
                id: 1,
                slug: 'a',
                title: 'Raid talk',
                categories: [raids],
                formats: [interview],
            }),
            episode({
                id: 2,
                slug: 'b',
                title: 'Lore chat',
                categories: [lore],
                formats: [interview],
            }),
            episode({
                id: 3,
                slug: 'c',
                title: 'Raid solo',
                categories: [raids],
                formats: [],
            }),
        ]
        const filtered = browseEpisodes(items, {
            query: '',
            categoryIds: new Set([raids.id]),
            formatIds: new Set([interview.id]),
        })
        expect(filtered.map((e) => e.slug)).toEqual(['a'])
    })

    it('groups by category with multi-appear and uncategorized bucket', () => {
        const items = [
            article({id: 1, slug: 'both', title: 'Both', categories: [lore, raids]}),
            article({id: 2, slug: 'none', title: 'None', categories: []}),
        ]
        const groups = groupByCategory(items, 'Uncategorized')
        expect(groups.map((g) => g.key)).toEqual([
            'category-1',
            'category-2',
            'uncategorized',
        ])
        expect(groups[0]?.items.map((i) => i.slug)).toEqual(['both'])
        expect(groups[1]?.items.map((i) => i.slug)).toEqual(['both'])
        expect(groups[2]?.items.map((i) => i.slug)).toEqual(['none'])
    })

    it('toggleId and hasActiveBrowse helpers', () => {
        expect(hasActiveBrowse('', new Set())).toBe(false)
        expect(hasActiveBrowse(' x ', new Set())).toBe(true)
        expect(hasActiveBrowse('', new Set([1]))).toBe(true)
        expect([...toggleId(new Set([1]), 2)].sort()).toEqual([1, 2])
        expect([...toggleId(new Set([1, 2]), 1)]).toEqual([2])
    })
})
