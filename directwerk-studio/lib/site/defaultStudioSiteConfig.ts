import type {SiteConfig} from '@directwerk/api/types'

/** Branding used on shared studio hosts before a workspace is selected. */
export const DEFAULT_STUDIO_SITE_CONFIG: SiteConfig = {
    tenant: {slug: 'directwerk', name: 'Directwerk Studio'},
    enabledModules: [],
    branding: {
        siteTitle: 'Directwerk Studio',
        primaryColor: '#1a1a2e',
        secondaryColor: '#e94560',
        logoUrl: null,
    },
    publicRssUrl: null,
    publicArticleRssUrl: null,
    publicSiteUrl: null,
    analytics: null,
    emailNotifyAvailable: false,
    studioHome: 'OVERVIEW',
    studioDesks: [],
}
