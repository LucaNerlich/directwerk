'use client'

import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import type {ReactNode} from 'react'
import {useSyncExternalStore} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import SiteShell from '@directwerk/ui/components/layout/site-shell'

import BrandLogo from '@/components/BrandLogo'
import SiteFooter from '@/components/SiteFooter'
import {
    clearTokens,
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

interface NavItem {
    href: string
    label: string
    module?: string
}

const NAV_ITEMS: readonly NavItem[] = [
    {href: '/', label: 'Start'},
    {href: '/episodes', label: 'Podcast', module: 'PODCAST'},
    {href: '/articles', label: 'Beiträge', module: 'DIGITAL_CONTENT'},
    {href: '/pricing', label: 'Preise', module: 'SUBSCRIPTION'},
    {href: '/downloads', label: 'Bonusdateien', module: 'DIGITAL_CONTENT'},
    {href: '/feeds', label: 'Feeds', module: 'PODCAST_RSS'},
    {href: '/account', label: 'Konto'},
]

function subscribeToken(callback: () => void): () => void {
    return subscribeToTokenStore(callback)
}

function readToken(): string | null {
    return getAccessToken()
}

function readTokenServer(): string | null {
    return null
}

export default function SiteHeader({
    children,
}: {
    children: ReactNode
}): React.JSX.Element {
    const config = useSiteConfig()
    const pathname = usePathname()
    const router = useRouter()
    const token = useSyncExternalStore(subscribeToken, readToken, readTokenServer)
    const brand = config.branding.siteTitle ?? config.tenant.name

    async function handleLogout(): Promise<void> {
        // Best-effort server-side revocation before clearing local state;
        // failure here must not block the local logout.
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Tenant-Host': getClientTenantHost(),
                },
                body: '{}',
            })
        } catch {
            // Ignore — clear local session regardless.
        }
        clearTokens()
        router.replace('/login')
    }

    const isAuthenticated = token !== null
    const items = NAV_ITEMS.filter(
        (item) =>
            item.module === undefined ||
            config.enabledModules.includes(item.module) ||
            (item.module === 'DIGITAL_CONTENT' &&
                config.enabledModules.includes('PODCAST')),
    )

    const navigation = items.map((item) => {
        const isActive =
            item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
            <Link
                key={item.href}
                href={item.href}
                className={buttonVariants({
                    variant: isActive ? 'secondary' : 'ghost',
                    className: 'justify-start',
                })}
                aria-current={isActive ? 'page' : undefined}
            >
                {item.label}
            </Link>
        )
    })
    const actions = isAuthenticated ? (
        <Button type="button" variant="outline" onClick={handleLogout}>
            Abmelden
        </Button>
    ) : (
        <Link
            href="/login"
            className={buttonVariants({variant: 'outline'})}
            aria-current={pathname === '/login' ? 'page' : undefined}
        >
            Anmelden
        </Link>
    )

    return (
        <SiteShell
            brand={
                <Link className="flex min-w-0 items-center gap-2" href="/">
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
