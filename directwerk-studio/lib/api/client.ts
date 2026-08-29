import type {SiteConfig, StudioDesk} from '@directwerk/api/types'

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
            return '/write'
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


export function defaultActiveDesk(config: SiteConfig): StudioDesk | null {
    if (config.studioDesks.length === 0) {
        return null
    }
    if (config.studioDesks.length === 1) {
        return config.studioDesks[0]
    }

    switch (config.studioHome) {
        case 'WRITE_DESK':
            return hasDesk(config, 'WRITE') ? 'WRITE' : null
        case 'PODCAST_DESK':
            return hasDesk(config, 'PODCAST') ? 'PODCAST' : null
        default:
            if (hasDesk(config, 'WRITE')) {
                return 'WRITE'
            }
            if (hasDesk(config, 'PODCAST')) {
                return 'PODCAST'
            }
            return null
    }
}
