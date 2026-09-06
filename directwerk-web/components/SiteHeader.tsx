'use client'

import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import type {ReactNode} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import SiteShell from '@directwerk/ui/components/layout/site-shell'

import BrandLogo from '@/components/BrandLogo'
import SiteFooter from '@/components/SiteFooter'
import {clearTokens} from '@/lib/auth/tokenStore'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

interface NavItem {
    href: string
    label: string
    module?: string
    modules?: readonly string[]
    requiresAuth?: boolean
}

const NAV_ITEMS: readonly NavItem[] = [
    {href: '/episodes', label: 'Podcast', module: 'PODCAST'},
    {href: '/articles', label: 'Beiträge', module: 'DIGITAL_CONTENT'},
    {href: '/pricing', label: 'Preise', module: 'SUBSCRIPTION'},
    {href: '/feeds', label: 'Feeds', modules: ['PODCAST_RSS', 'ARTICLE_RSS']},
    {href: '/downloads', label: 'Bonusdateien', module: 'BONUS_CONTENT', requiresAuth: true},
    {href: '/account', label: 'Konto'},
]

export default function SiteHeader({
    children,
}: {
    children: ReactNode
}): React.JSX.Element {
    const config = useSiteConfig()
    const pathname = usePathname()
    const router = useRouter()
    const {isAuthenticated} = useSubscriberAuth()
    const brand = config.branding.siteTitle ?? config.tenant.name

    async function handleLogout(): Promise<void> {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Host': getWebClientTenantHost(),
                },
                body: '{}',
            })
        } catch {
            // Ignore — clear local session regardless.
        }
        clearTokens()
        router.replace('/login')
    }

    const items = NAV_ITEMS.filter((item) => {
        if (item.requiresAuth === true && !isAuthenticated) {
            return false
        }
        if (item.modules !== undefined) {
            return item.modules.some((moduleKey) =>
                config.enabledModules.includes(moduleKey),
            )
        }
        if (item.module === undefined) {
            return true
        }
        return (
            config.enabledModules.includes(item.module) ||
            (item.module === 'DIGITAL_CONTENT' &&
                config.enabledModules.includes('PODCAST'))
        )
    })

    const navigation = items.map((item) => {
        const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
        const label =
            item.href === '/account' && isAuthenticated ? 'Mein Konto' : item.label
        return (
            <Link
                key={item.href}
                href={item.href}
                className={buttonVariants({
                    variant: isActive ? 'secondary' : 'ghost',
                    className: 'min-h-[44px] justify-start',
                })}
                aria-current={isActive ? 'page' : undefined}
            >
                {label}
            </Link>
        )
    })
    const actions = isAuthenticated ? (
        <>
            <Link
                className={buttonVariants({variant: 'ghost', size: 'sm'})}
                href="/account"
            >
                Mein Konto
            </Link>
            <Button type="button" variant="outline" onClick={handleLogout}>
                Abmelden
            </Button>
        </>
    ) : (
        <>
            <Link
                className={buttonVariants({variant: 'ghost', size: 'sm'})}
                href="/register"
            >
                Registrieren
            </Link>
            <Link
                href="/login"
                className={buttonVariants({variant: 'outline'})}
                aria-current={pathname === '/login' ? 'page' : undefined}
            >
                Anmelden
            </Link>
        </>
    )

    return (
        <SiteShell
            brand={
                <Link className="flex min-w-0 items-center gap-2 min-h-[44px]" href="/">
                    <BrandLogo
                        className="h-8 w-auto"
                        logoUrl={config.branding.logoUrl}
                        name={brand}
                    />
                    <span className="truncate text-lg font-semibold tracking-tight">
                        {brand}
                    </span>
                </Link>
            }
            navigation={navigation}
            mobileNavigation={navigation}
            actions={actions}
        >
            {children}
            <SiteFooter />
        </SiteShell>
    )
}
