'use client'

import type {ReactNode} from 'react'

import BrandTheme from '@directwerk/ui/components/brand-theme'
import AppShell from '@directwerk/ui/components/layout/app-shell'

import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import DeskSwitcher from '@/components/studio/DeskSwitcher'
import LogoutButton from '@/components/studio/LogoutButton'
import SideNav from '@/components/studio/SideNav'
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

    return (
        <SiteConfigProvider config={config}>
            <BrandTheme
                className="min-h-svh"
                primaryHex={config.branding.primaryColor}
                secondaryHex={config.branding.secondaryColor}
            >
                <AppShell
                    brand={
                        <div className="flex min-w-0 flex-col gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">
                                    {config.tenant.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {dict.meta.productName}
                                </p>
                            </div>
                            <DeskSwitcher config={config} />
                            <LanguageSwitcher />
                        </div>
                    }
                    navigation={<SideNav config={config} />}
                    footer={<LogoutButton />}
                    navigationTriggerLabel={dict.shell.openNav}
                    skipLinkLabel={dict.shell.skipToContent}
                >
                    {children}
                </AppShell>
            </BrandTheme>
        </SiteConfigProvider>
    )
}
