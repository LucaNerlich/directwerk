import Fuse, {type FuseOptionKey} from 'fuse.js'

/** Options for {@link fuzzyFilter}. */
export interface FuzzyFilterOptions<T> {
    /** Fields (or getters) Fuse should search. */
    keys: Array<FuseOptionKey<T>>
    /**
     * Fuse match threshold (0 = perfect, 1 = match anything).
     * Default `0.4` is looser than Fuse’s `0.6` so short typos still hit.
     */
    threshold?: number
}

const DEFAULT_THRESHOLD = 0.4
/** Keep hits within this score distance of the best match (Fuse: 0 = perfect). */
const BEST_SCORE_SLACK = 0.05

/**
 * Client-side fuzzy filter over an in-memory list.
 * Empty / whitespace-only query returns `items` unchanged (same reference).
 * Among Fuse hits, drops results worse than the best score by {@link BEST_SCORE_SLACK}
 * so near-neighbor filenames (e.g. `cover-a` vs query `cover-b`) stay out while typos still match.
 */
export function fuzzyFilter<T>(
    items: readonly T[],
    query: string,
    options: FuzzyFilterOptions<T>,
): T[] {
    const trimmed = query.trim()
    if (trimmed.length === 0) {
        return items as T[]
    }

    const fuse = new Fuse(items as T[], {
        keys: options.keys,
        threshold: options.threshold ?? DEFAULT_THRESHOLD,
        ignoreLocation: true,
        includeScore: true,
    })

    const hits = fuse.search(trimmed)
    if (hits.length === 0) {
        return []
    }

    const best = hits[0]?.score ?? 0
    const cutoff = best + BEST_SCORE_SLACK
    return hits
        .filter((result) => (result.score ?? 0) <= cutoff)
        .map((result) => result.item)
}
