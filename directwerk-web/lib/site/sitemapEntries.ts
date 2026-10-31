import type {MetadataRoute} from 'next'

import {defaultLocale, locales} from '@/lib/i18n/config'

/**
 * One sitemap `<url>` per logical page: `<loc>` is the default-locale URL, with
 * `xhtml:link` hreflang alternates for every locale plus `x-default` (same URL
 * as the default locale — there is no language-selector landing page).
 *
 * @see https://developers.google.com/search/docs/specialty/international/localized-versions#sitemap
 */
export function localizedSitemapEntry(
    origin: string,
    pathSuffix: string,
    lastModified?: Date,
): MetadataRoute.Sitemap[number] {
    const languages: Record<string, string> = Object.fromEntries(
        locales.map((lang) => [lang, `${origin}/${lang}${pathSuffix}`]),
    )
    languages['x-default'] = `${origin}/${defaultLocale}${pathSuffix}`

    return {
        url: `${origin}/${defaultLocale}${pathSuffix}`,
        lastModified,
        alternates: {languages},
    }
}
