'use client'

import Link from 'next/link'
import {usePathname, useRouter} from 'next/navigation'
import {useState, type ReactNode} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import SiteShell from '@directwerk/ui/components/layout/site-shell'

import BrandLogo from '@/components/BrandLogo'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import SiteFooter from '@/components/SiteFooter'
import {clearSessionTokens} from '@/lib/auth/session'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath, stripLocalePrefix} from '@/lib/i18n/paths'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

interface NavItem {
    href: string
    label: string
    module?: string
    modules?: readonly string[]
    requiresAuth?: boolean
}

export default function SiteHeader({
    children,
}: {
    children: ReactNode
}): React.JSX.Element {
    const config = useSiteConfig()
    const pathname = usePathname()
    const barePath = stripLocalePrefix(pathname)
    const router = useRouter()
    const lang = useLocale()
    const dictionary = useDictionary()
    const {isAuthenticated} = useSubscriberAuth()
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const brand = config.branding.siteTitle ?? config.tenant.name
    const href = (path: string) => localizedPath(lang, path)

    const navItems: readonly NavItem[] = [
        {href: '/episodes', label: dictionary.nav.podcast, module: 'PODCAST'},
        {href: '/articles', label: dictionary.nav.articles, module: 'DIGITAL_CONTENT'},
        {href: '/pricing', label: dictionary.nav.pricing, module: 'SUBSCRIPTION'},
        {
            href: '/feeds',
            label: dictionary.nav.feeds,
            modules: ['PODCAST_RSS', 'ARTICLE_RSS'],
        },
        {
            href: '/downloads',
            label: dictionary.nav.downloads,
            module: 'BONUS_CONTENT',
            requiresAuth: true,
        },
        {href: '/account', label: dictionary.nav.account},
    ]

    async function handleLogout(): Promise<void> {
        setIsLoggingOut(true)
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
        clearSessionTokens()
        router.replace(href('/login'))
    }

    const items = navItems.filter((item) => {
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
        const isActive = barePath === item.href || barePath.startsWith(`${item.href}/`)
        const label =
            item.href === '/account' && isAuthenticated
                ? dictionary.nav.myAccount
                : item.label
        return (
            <Link
                key={item.href}
                href={href(item.href)}
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
    const actions = (
        <>
            <LanguageSwitcher />
            {isAuthenticated ? (
                <>
                    <Link
                        className={buttonVariants({variant: 'ghost', size: 'sm'})}
                        href={href('/account')}
                    >
                        {dictionary.nav.myAccount}
                    </Link>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isLoggingOut}
                        onClick={() => {
                            void handleLogout()
                        }}
                    >
                        {isLoggingOut ? dictionary.nav.logoutPending : dictionary.nav.logout}
                    </Button>
                </>
            ) : (
                <>
                    <Link
                        className={buttonVariants({variant: 'ghost', size: 'sm'})}
                        href={href('/register')}
                    >
                        {dictionary.nav.register}
                    </Link>
                    <Link
                        href={href('/login')}
                        className={buttonVariants({variant: 'outline'})}
                        aria-current={barePath === '/login' ? 'page' : undefined}
                    >
                        {dictionary.nav.login}
                    </Link>
                </>
            )}
        </>
    )

    return (
        <SiteShell
            brand={
                <Link className="flex min-w-0 items-center gap-2 min-h-[44px]" href={href('/')}>
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
