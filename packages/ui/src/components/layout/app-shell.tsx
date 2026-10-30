'use client'

import type {ReactNode} from 'react'
import {useEffect, useState} from 'react'

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from '#components/sidebar'
import {TooltipProvider} from '#components/tooltip'

const SIDEBAR_COOKIE = 'dw-sidebar-open'

function readSidebarOpen(): boolean {
    if (typeof document === 'undefined') {
        return true
    }
    const match = document.cookie.match(new RegExp(`(?:^|; )${SIDEBAR_COOKIE}=([^;]*)`))
    if (match === null) {
        return true
    }
    return match[1] !== '0'
}

function persistSidebarOpen(open: boolean): void {
    if (typeof document === 'undefined') {
        return
    }
    document.cookie = `${SIDEBAR_COOKIE}=${open ? '1' : '0'}; path=/; max-age=31536000; SameSite=Lax`
}

export default function AppShell({
    brand,
    navigation,
    footer,
    children,
    navigationTriggerLabel = 'Navigation öffnen',
    skipLinkLabel = 'Zum Inhalt springen',
    mobileTitle,
    mobilePrimaryAction,
}: {
    brand: ReactNode
    navigation: ReactNode
    footer?: ReactNode
    children: ReactNode
    navigationTriggerLabel?: string
    skipLinkLabel?: string
    /** Current section title shown in the sticky mobile bar. */
    mobileTitle?: string
    /** Optional primary CTA rendered on the right of the mobile bar. */
    mobilePrimaryAction?: ReactNode
}): React.JSX.Element {
    const [open, setOpen] = useState(true)

    useEffect(() => {
        setOpen(readSidebarOpen())
    }, [])

    return (
        <TooltipProvider>
            <SidebarProvider
                onOpenChange={(next) => {
                    setOpen(next)
                    persistSidebarOpen(next)
                }}
                open={open}
            >
                <a
                    className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
                    href="#main-content"
                >
                    {skipLinkLabel}
                </a>
                <Sidebar collapsible="icon">
                    <SidebarHeader className="border-b p-4 group-data-[collapsible=icon]:p-2">
                        {brand}
                    </SidebarHeader>
                    <SidebarContent className="px-2 py-3">{navigation}</SidebarContent>
                    {footer !== undefined ? (
                        <SidebarFooter className="border-t p-3">{footer}</SidebarFooter>
                    ) : null}
                    <SidebarRail />
                </Sidebar>
                {/* Plain div (not SidebarInset, which renders <main>): the
                    skip-link target below is the single main landmark. */}
                <div
                    className="relative flex w-full flex-1 flex-col bg-background"
                    data-dw-shell="app-main"
                >
                    <div
                        className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:hidden"
                        data-dw-shell="app-mobile-bar"
                    >
                        <SidebarTrigger aria-label={navigationTriggerLabel} />
                        {mobileTitle !== undefined && mobileTitle.length > 0 ? (
                            <p className="min-w-0 flex-1 truncate text-sm font-medium">{mobileTitle}</p>
                        ) : (
                            <span className="flex-1" />
                        )}
                        {mobilePrimaryAction}
                    </div>
                    <main
                        className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
                        id="main-content"
                        tabIndex={-1}
                    >
                        {children}
                    </main>
                </div>
            </SidebarProvider>
        </TooltipProvider>
    )
}
