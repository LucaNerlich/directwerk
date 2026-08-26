import type {SiteConfig} from '@directwerk/api/types'

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

export function deskHome(desk: SiteConfig['studioDesks'][number]): string {
    switch (desk) {
        case 'WRITE':
            return '/write/articles'
        case 'PODCAST':
            return '/podcast'
    }
}

export function defaultHomePath(home: SiteConfig['studioHome']): string {
    switch (home) {
        case 'WRITE_DESK':
            return deskHome('WRITE')
        case 'PODCAST_DESK':
            return deskHome('PODCAST')
        default:
            return '/'
    }
}
