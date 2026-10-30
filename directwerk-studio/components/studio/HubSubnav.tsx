'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {stripLangPrefix} from '@/lib/i18n/paths'
import type {NavigationItem} from '@/lib/studio/navigation'
import {usePathname} from 'next/navigation'

function isActivePath(pathname: string, href: string): boolean {
    const path = stripLangPrefix(pathname)
    if (href === '/manage' || href === '/media') {
        return path === href
    }
    return path === href || path.startsWith(`${href}/`)
}

export default function HubSubnav({
    ariaLabel,
    items,
}: {
    ariaLabel: string
    items: NavigationItem[]
}): React.JSX.Element {
    const pathname = usePathname()

    return (
        <nav aria-label={ariaLabel} className="border-b">
            <ul className="-mb-px flex flex-wrap gap-1">
                {items.map((item) => {
                    const active = isActivePath(pathname, item.href)
                    return (
                        <li key={item.href}>
                            <LocaleLink
                                aria-current={active ? 'page' : undefined}
                                className={[
                                    'inline-flex min-h-9 items-center border-b-2 px-3 py-2 text-sm transition-colors',
                                    active
                                        ? 'border-primary font-medium text-foreground'
                                        : 'border-transparent text-muted-foreground hover:text-foreground',
                                ].join(' ')}
                                href={item.href}
                            >
                                {item.label}
                            </LocaleLink>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}
