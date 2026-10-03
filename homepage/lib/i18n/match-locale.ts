/**
 * Tiny Accept-Language matcher (no Negotiator / @formatjs deps).
 * Picks the best supported locale by quality, then primary tag, then default.
 */
export function matchAcceptLanguage(
    header: string | null | undefined,
    locales: readonly string[],
    defaultLocale: string,
): string {
    if (!header || header.trim().length === 0) {
        return defaultLocale
    }

    const preferred = header
        .split(',')
        .map((part) => {
            const [rawTag, ...params] = part.trim().split(';')
            const tag = rawTag.trim().toLowerCase()
            const qParam = params.find((param) => param.trim().startsWith('q='))
            const quality = qParam ? Number(qParam.trim().slice(2)) : 1
            return {
                tag,
                quality: Number.isFinite(quality) ? quality : 0,
            }
        })
        .filter((entry) => entry.tag.length > 0)
        .sort((a, b) => b.quality - a.quality)

    const normalizedLocales = locales.map((locale) => locale.toLowerCase())

    for (const {tag} of preferred) {
        const exactIndex = normalizedLocales.indexOf(tag)
        if (exactIndex >= 0) {
            return locales[exactIndex]!
        }

        const primary = tag.split('-')[0]!
        const primaryIndex = normalizedLocales.indexOf(primary)
        if (primaryIndex >= 0) {
            return locales[primaryIndex]!
        }
    }

    return defaultLocale
}
