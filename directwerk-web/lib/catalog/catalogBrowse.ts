import {fuzzyFilter} from '@directwerk/ui/lib/fuzzy'

import type {PublicArticle, PublicCategory, PublicEpisode, PublicFormat} from '@directwerk/api/types'

/** Taxonomy chip derived from catalog items. */
export interface CatalogTag {
    id: number
    slug: string
    name: string
}

export interface CatalogGroup<T> {
    key: string
    label: string
    items: T[]
}

export interface ArticleBrowseOptions {
    query: string
    /** Empty set = no category filter. */
    categoryIds: ReadonlySet<number>
}

export interface EpisodeBrowseOptions {
    query: string
    categoryIds: ReadonlySet<number>
    formatIds: ReadonlySet<number>
}

function compareTags(a: CatalogTag, b: CatalogTag): number {
    return a.name.localeCompare(b.name) || a.id - b.id
}

function uniqueTags(tags: CatalogTag[]): CatalogTag[] {
    const byId = new Map<number, CatalogTag>()
    for (const tag of tags) {
        if (!byId.has(tag.id)) {
            byId.set(tag.id, tag)
        }
    }
    return [...byId.values()].sort(compareTags)
}

/** Unique categories present on the given items, sorted by name. */
export function collectCategories(
    items: ReadonlyArray<{categories: PublicCategory[]}>,
): CatalogTag[] {
    return uniqueTags(items.flatMap((item) => item.categories))
}

/** Unique formats present on the given episodes, sorted by name. */
export function collectFormats(items: ReadonlyArray<{formats: PublicFormat[]}>): CatalogTag[] {
    return uniqueTags(
        items.flatMap((item) =>
            item.formats.map((format) => ({
                id: format.id,
                slug: format.slug,
                name: format.name,
            })),
        ),
    )
}

function matchesAnyTag(
    tags: ReadonlyArray<{id: number}>,
    selectedIds: ReadonlySet<number>,
): boolean {
    if (selectedIds.size === 0) {
        return true
    }
    return tags.some((tag) => selectedIds.has(tag.id))
}

/**
 * Filter + Fuse search for public articles.
 * Taxonomy filter runs before fuzzy search so chips narrow the Fuse corpus.
 */
export function browseArticles(
    items: readonly PublicArticle[],
    options: ArticleBrowseOptions,
): PublicArticle[] {
    const tagged = items.filter((item) => matchesAnyTag(item.categories, options.categoryIds))
    return fuzzyFilter(tagged, options.query, {
        keys: [
            'title',
            'excerpt',
            'slug',
            {name: 'categories', getFn: (item) => item.categories.map((c) => c.name)},
        ],
    })
}

/**
 * Filter + Fuse search for public episodes (categories and formats).
 */
export function browseEpisodes(
    items: readonly PublicEpisode[],
    options: EpisodeBrowseOptions,
): PublicEpisode[] {
    const tagged = items.filter(
        (item) =>
            matchesAnyTag(item.categories, options.categoryIds) &&
            matchesAnyTag(item.formats, options.formatIds),
    )
    return fuzzyFilter(tagged, options.query, {
        keys: [
            'title',
            'description',
            'slug',
            'seriesSlug',
            {name: 'formats', getFn: (item) => item.formats.map((f) => f.name)},
            {name: 'categories', getFn: (item) => item.categories.map((c) => c.name)},
        ],
    })
}

/**
 * Group items by category. Multi-category items appear under each match.
 * Items with no categories land in a trailing uncategorized group.
 */
export function groupByCategory<T extends {id: number; categories: PublicCategory[]}>(
    items: readonly T[],
    uncategorizedLabel: string,
): CatalogGroup<T>[] {
    const groups = new Map<number, CatalogGroup<T>>()
    const uncategorized: T[] = []

    for (const item of items) {
        if (item.categories.length === 0) {
            uncategorized.push(item)
            continue
        }
        for (const category of item.categories) {
            let group = groups.get(category.id)
            if (group === undefined) {
                group = {
                    key: `category-${category.id}`,
                    label: category.name,
                    items: [],
                }
                groups.set(category.id, group)
            }
            group.items.push(item)
        }
    }

    const ordered = [...groups.entries()]
        .sort(([, a], [, b]) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key))
        .map(([, group]) => group)

    if (uncategorized.length > 0) {
        ordered.push({
            key: 'uncategorized',
            label: uncategorizedLabel,
            items: uncategorized,
        })
    }

    return ordered
}

export function hasActiveBrowse(query: string, ...idSets: ReadonlySet<number>[]): boolean {
    if (query.trim().length > 0) {
        return true
    }
    return idSets.some((ids) => ids.size > 0)
}

export function toggleId(ids: ReadonlySet<number>, id: number): Set<number> {
    const next = new Set(ids)
    if (next.has(id)) {
        next.delete(id)
    } else {
        next.add(id)
    }
    return next
}
