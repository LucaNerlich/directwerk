import type {Dictionary} from '@/lib/i18n/dictionary'
import {stripLangPrefix} from '@/lib/i18n/paths'
import type {StudioDesk} from '@directwerk/api/types'

export interface MobileShellModel {
    title: string
    primaryHref: string | null
    primaryLabel: string | null
}

export function resolveMobileShell(
    pathname: string,
    dict: Dictionary,
    activeDesk: StudioDesk | null,
): MobileShellModel {
    const path = stripLangPrefix(pathname)
    const v = dict.nav.verwaltung

    if (path === '/' || path === '') {
        return {title: dict.shell.home.overview, primaryHref: null, primaryLabel: null}
    }
    if (path.startsWith('/write')) {
        return {
            title: dict.nav.write.label,
            primaryHref: '/write/articles/new',
            primaryLabel: dict.shell.newContentCtaWrite,
        }
    }
    if (path.startsWith('/podcast')) {
        return {
            title: dict.nav.podcast.label,
            primaryHref: '/podcast/episodes/new',
            primaryLabel: dict.shell.newContentCtaPodcast,
        }
    }
    if (path.startsWith('/media') || path.startsWith('/bonus') || path.startsWith('/manage/categories')) {
        return {title: v.mediaHub, primaryHref: null, primaryLabel: null}
    }
    if (path.startsWith('/manage')) {
        return {title: v.subscriptions, primaryHref: null, primaryLabel: null}
    }
    if (path.startsWith('/settings')) {
        return {title: v.settings, primaryHref: null, primaryLabel: null}
    }
    if (path.startsWith('/team')) {
        return {title: v.team, primaryHref: null, primaryLabel: null}
    }
    if (path.startsWith('/analytics')) {
        return {title: v.statistics, primaryHref: null, primaryLabel: null}
    }

    if (activeDesk === 'WRITE') {
        return {
            title: dict.nav.write.label,
            primaryHref: '/write/articles/new',
            primaryLabel: dict.shell.newContentCtaWrite,
        }
    }
    if (activeDesk === 'PODCAST') {
        return {
            title: dict.nav.podcast.label,
            primaryHref: '/podcast/episodes/new',
            primaryLabel: dict.shell.newContentCtaPodcast,
        }
    }

    return {title: dict.shell.mobileTitleFallback, primaryHref: null, primaryLabel: null}
}
