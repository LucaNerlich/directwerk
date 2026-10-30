'use client'

import type {ReactNode} from 'react'

import BrandTheme from '@directwerk/ui/components/brand-theme'
import {Button} from '@directwerk/ui/components/button'
import AppShell from '@directwerk/ui/components/layout/app-shell'
import {usePathname} from 'next/navigation'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import DeskSwitcher from '@/components/studio/DeskSwitcher'
import LogoutButton from '@/components/studio/LogoutButton'
import SideNav from '@/components/studio/SideNav'
import {resolveMobileShell} from '@/lib/studio/mobileShell'
import {useActiveDesk} from '@/lib/studio/useActiveDesk'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import type {SiteConfig} from '@directwerk/api/types'

export default function StudioShell({
    config,
    children,
}: {
    config: SiteConfig
    children: ReactNode
}) {
    const dict = useDictionary()
    const pathname = usePathname()
    const activeDesk = useActiveDesk(config)
    const mobile = resolveMobileShell(pathname, dict, activeDesk)

    return (
        <SiteConfigProvider config={config}>
            <BrandTheme
                className="dw-brand min-h-svh"
                primaryHex={config.branding.primaryColor}
                secondaryHex={config.branding.secondaryColor}
            >
                <AppShell
                    brand={
                        <div className="flex min-w-0 flex-col gap-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2">
                            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                                <LocaleLink
                                    className="block min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    href="/"
                                    title={config.tenant.name}
                                >
                                    <p className="truncate text-sm font-semibold">
                                        {config.tenant.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {dict.meta.productName}
                                    </p>
                                </LocaleLink>
                            </div>
                            <div className="group-data-[collapsible=icon]:hidden">
                                <DeskSwitcher config={config} />
                            </div>
                        </div>
                    }
                    navigation={<SideNav config={config} />}
                    footer={<LogoutButton />}
                    mobileTitle={mobile.title}
                    mobilePrimaryAction={
                        mobile.primaryHref !== null && mobile.primaryLabel !== null ? (
                            <Button
                                className="shrink-0"
                                nativeButton={false}
                                render={<LocaleLink href={mobile.primaryHref} />}
                                size="sm"
                            >
                                {mobile.primaryLabel}
                            </Button>
                        ) : undefined
                    }
                    navigationTriggerLabel={dict.shell.openNav}
                    skipLinkLabel={dict.shell.skipToContent}
                    collapseNavLabel={dict.shell.collapseNav}
                    expandNavLabel={dict.shell.expandNav}
                >
                    {children}
                </AppShell>
            </BrandTheme>
        </SiteConfigProvider>
    )
}
