'use client'

import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import type {ReactNode} from 'react'
import {useSyncExternalStore} from 'react'

import {Button, buttonVariants} from '@publish/ui/components/button'
import SiteShell from '@publish/ui/components/layout/site-shell'

import {
    clearTokens,
    getAccessToken,
    subscribeToTokenStore,
} from '@/lib/auth/tokenStore'

interface NavItem {
    href: string
    label: string
}

const NAV_ITEMS: readonly NavItem[] = [
    {href: '/', label: 'Home'},
    {href: '/articles', label: 'Articles'},
    {href: '/episodes', label: 'Episodes'},
    {href: '/formats', label: 'Formats'},
    {href: '/feeds', label: 'Feeds'},
    {href: '/pricing', label: 'Pricing'},
    {href: '/downloads', label: 'Downloads'},
    {href: '/register', label: 'Register'},
    {href: '/account', label: 'Account'},
    {href: '/media', label: 'Media'},
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

export default function Header({children}: {children: ReactNode}): React.JSX.Element {
    const pathname = usePathname()
    const router = useRouter()
    const token = useSyncExternalStore(subscribeToken, readToken, readTokenServer)

    function handleLogout(): void {
        clearTokens()
        router.replace('/login')
    }

    const isAuthenticated = token !== null

    const navigation = NAV_ITEMS.map((item) => {
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
            Logout
        </Button>
    ) : (
        <Link
            href="/login"
            className={buttonVariants({variant: 'outline'})}
            aria-current={pathname === '/login' ? 'page' : undefined}
        >
            Login
        </Link>
    )

    return (
        <SiteShell
            brand={
                <Link className="text-lg font-semibold tracking-tight" href="/">
                    Directwerk
                </Link>
            }
            navigation={navigation}
            mobileNavigation={navigation}
            actions={actions}
        >
            {children}
        </SiteShell>
    )
}
