'use client'

import {usePathname} from 'next/navigation'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {deskHome, hasDesk} from '@/lib/api/client'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {setLastActiveDesk} from '@/lib/studio/activeDeskStorage'
import {useActiveDesk} from '@/lib/studio/useActiveDesk'
import type {SiteConfig, StudioDesk} from '@directwerk/api/types'

/**
 * Builds the CSS classes for a desk tab based on its active state.
 *
 * @param active - Whether the tab is currently active
 * @returns The CSS class string for the tab
 */
function tabClassName(active: boolean): string {
    return `flex min-h-9 items-center justify-center rounded-md px-2.5 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active ? 'bg-background text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
    }`
}

export default function DeskSwitcher({config}: {config: SiteConfig}): React.JSX.Element | null {
    const activeDesk = useActiveDesk(config)
    const me = useOptionalMe()
    const dict = useDictionary()
    usePathname() // keep desk highlighting reactive to navigations

    if (!hasDesk(config, 'WRITE') || !hasDesk(config, 'PODCAST')) {
        return null
    }

    const persistDesk = (desk: StudioDesk): void => {
        setLastActiveDesk(desk, {
            tenantId: me?.tenantId ?? null,
            tenantSlug: config.tenant.slug,
        })
    }

    return (
        <nav
            aria-label={dict.shell.desksAria}
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium"
        >
            <LocaleLink
                aria-current={activeDesk === 'WRITE' ? 'page' : undefined}
                className={tabClassName(activeDesk === 'WRITE')}
                href={deskHome('WRITE')}
                onClick={() => persistDesk('WRITE')}
            >
                {dict.desks.write}
            </LocaleLink>
            <LocaleLink
                aria-current={activeDesk === 'PODCAST' ? 'page' : undefined}
                className={tabClassName(activeDesk === 'PODCAST')}
                href={deskHome('PODCAST')}
                onClick={() => persistDesk('PODCAST')}
            >
                {dict.desks.podcast}
            </LocaleLink>
        </nav>
    )
}
