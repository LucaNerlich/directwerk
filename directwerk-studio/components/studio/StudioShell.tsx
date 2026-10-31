'use client'

import {useState, type ReactNode} from 'react'

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
import {tenantBrandImageSrc} from '@/lib/site/tenantBrandImageSrc'
import type {SiteConfig} from '@directwerk/api/types'

function tenantHomeInitial(name: string): string {
    const trimmed = name.trim()
    return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?'
}

function TenantBrandMark({
    branding,
    name,
}: {
    branding: SiteConfig['branding']
    name: string
}): React.JSX.Element {
    const [imageFailed, setImageFailed] = useState(false)
    const src = imageFailed
        ? null
        : tenantBrandImageSrc(branding.faviconUrl, branding.logoUrl)
    // Expanded: 20px next to the name; collapsed icon rail: fill the 32px home hit target.
    const box =
        'size-5 group-data-[collapsible=icon]:size-8'
    const text =
        'text-[10px] group-data-[collapsible=icon]:text-sm'

    if (src !== null) {
        return (
            <img
                alt=""
                className={`${box} shrink-0 rounded-md object-cover`}
                height={32}
                onError={() => {
                    setImageFailed(true)
                }}
                src={src}
                width={32}
            />
        )
    }

    return (
        <span
            aria-hidden="true"
            className={`flex ${box} shrink-0 items-center justify-center rounded-md bg-primary/10 ${text} font-semibold text-primary`}
        >
            {tenantHomeInitial(name)}
        </span>
    )
}

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
                            <LocaleLink
                                aria-label={config.tenant.name}
                                className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                                href="/"
                                title={config.tenant.name}
                            >
                                <TenantBrandMark
                                    branding={config.branding}
                                    name={config.tenant.name}
                                />
                                <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                                    <p className="truncate text-sm font-semibold">
                                        {config.tenant.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {dict.meta.productName}
                                    </p>
                                </span>
                            </LocaleLink>
                            <div className="group-data-[collapsible=icon]:hidden">
                                <DeskSwitcher config={config} />
                            </div>
                        </div>
                    }
                    navigation={<SideNav config={config} />}
                    footer={<LogoutButton publicSiteUrl={config.publicSiteUrl} />}
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
