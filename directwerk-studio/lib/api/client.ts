import type {SiteConfig} from '@/lib/api/types'

export function hasModule(config: SiteConfig, moduleKey: string): boolean {
    return config.enabledModules.includes(moduleKey)
}

export function hasDesk(config: SiteConfig, desk: SiteConfig['studioDesks'][number]): boolean {
    return new Set(config.studioDesks).has(desk)
}

export function resolveActiveDesk(
    pathname: string,
    config: SiteConfig,
): 'WRITE' | 'PODCAST' | null {
    if (pathname === '/write' || pathname.startsWith('/write/')) {
        return hasDesk(config, 'WRITE') ? 'WRITE' : null
    }
    if (pathname === '/podcast' || pathname.startsWith('/podcast/')) {
        return hasDesk(config, 'PODCAST') ? 'PODCAST' : null
    }
    if (config.studioDesks.length === 1) {
        return config.studioDesks[0]
    }
    return null
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
