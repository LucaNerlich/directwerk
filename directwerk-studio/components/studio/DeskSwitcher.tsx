'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {deskHome, hasDesk} from '@/lib/api/client'
import {setLastActiveDesk} from '@/lib/studio/activeDeskStorage'
import {useActiveDesk} from '@/lib/studio/useActiveDesk'
import type {SiteConfig, StudioDesk} from '@directwerk/api/types'

function tabClassName(active: boolean): string {
    return [
        'flex min-h-9 items-center justify-center rounded-md px-2.5 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
            ? 'bg-background text-foreground shadow-xs font-semibold'
            : 'text-muted-foreground hover:text-foreground',
    ]
        .filter((part) => part.length > 0)
        .join(' ')
}

function handleDeskSelect(desk: StudioDesk): void {
    setLastActiveDesk(desk)
}

export default function DeskSwitcher({config}: {config: SiteConfig}): React.JSX.Element | null {
    if (!hasDesk(config, 'WRITE') || !hasDesk(config, 'PODCAST')) {
        return null
    }

    const activeDesk = useActiveDesk(config)

    return (
        <nav
            aria-label="Desks"
            className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium"
        >
            <Link
                aria-current={activeDesk === 'WRITE' ? 'page' : undefined}
                className={tabClassName(activeDesk === 'WRITE')}
                href={deskHome('WRITE')}
                onClick={() => handleDeskSelect('WRITE')}
            >
                Schreiben
            </Link>
            <Link
                aria-current={activeDesk === 'PODCAST' ? 'page' : undefined}
                className={tabClassName(activeDesk === 'PODCAST')}
                href={deskHome('PODCAST')}
                onClick={() => handleDeskSelect('PODCAST')}
            >
                Podcast
            </Link>
        </nav>
    )
}
