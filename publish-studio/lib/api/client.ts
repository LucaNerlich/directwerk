import type {SiteConfig} from '@/lib/api/types'

export function hasModule(config: SiteConfig, moduleKey: string): boolean {
    return config.enabledModules.includes(moduleKey)
}

export function hasDesk(config: SiteConfig, desk: SiteConfig['studioDesks'][number]): boolean {
    return new Set(config.studioDesks).has(desk)
}

export function defaultHomePath(home: SiteConfig['studioHome']): string {
    switch (home) {
        case 'WRITE_DESK':
            return '/write/articles'
        case 'PODCAST_DESK':
            return '/podcast'
        default:
            return '/'
    }
}
