import type {MetadataRoute} from 'next'

import {locales} from '@/lib/i18n/config'

const SITE_ORIGIN = 'https://directwerk.org'
const PATHS = ['', '/developers', '/privacy', '/imprint']

/** Issue #446: enumerates both locales for every public page with hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
    return locales.flatMap((locale) =>
        PATHS.map((path) => ({
            url: `${SITE_ORIGIN}/${locale}${path}`,
            alternates: {
                languages: Object.fromEntries(
                    locales.map((alternate) => [alternate, `${SITE_ORIGIN}/${alternate}${path}`]),
                ),
            },
        })),
    )
}
