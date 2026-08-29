'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {Button} from '@directwerk/ui/components/button'
import SiteShell from '@directwerk/ui/components/layout/site-shell'
import {cn} from '@directwerk/ui/lib/utils'

import MarketingFooter from '@/components/marketing/MarketingFooter'
import {NAV_ITEMS} from '@/lib/marketing/constants'

function NavLink({
    href,
    label,
    pathname,
    external,
}: {
    href: string
    label: string
    pathname: string
    external?: boolean
}): React.JSX.Element {
    const isDevelopers = href === '/developers'
    const active = isDevelopers
        ? pathname.startsWith('/developers')
        : pathname === '/' && href.startsWith('/#')

    if (external) {
        return (
            <a
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                href={href}
                rel="noopener noreferrer"
                target="_blank"
            >
                {label}
            </a>
        )
    }

    return (
        <Link
            className={cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
            href={href}
        >
            {label}
        </Link>
    )
}

export default function MarketingShell({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    const pathname = usePathname()

    const brand = (
        <Link className="text-lg font-semibold tracking-tight" href="/">
            Directwerk
        </Link>
    )

    const navigation = NAV_ITEMS.map((item) => (
        <NavLink
            external={'external' in item ? item.external : undefined}
            href={item.href}
            key={item.href}
            label={item.label}
            pathname={pathname}
        />
    ))

    const actions = (
        <Button render={<a href="/#contact" />} variant="outline">
            Kontakt
        </Button>
    )

    return (
        <SiteShell
            actions={actions}
            brand={brand}
            mobileNavigation={navigation}
            navigation={navigation}
        >
            {children}
            <MarketingFooter />
        </SiteShell>
    )
}
