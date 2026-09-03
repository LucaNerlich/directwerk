'use client'

import type {ReactNode} from 'react'

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarProvider,
    SidebarTrigger,
} from '#components/sidebar'
import {TooltipProvider} from '#components/tooltip'

export default function AppShell({
    brand,
    navigation,
    footer,
    children,
    navigationTriggerLabel = 'Navigation öffnen',
    skipLinkLabel = 'Zum Inhalt springen',
}: {
    brand: ReactNode
    navigation: ReactNode
    footer?: ReactNode
    children: ReactNode
    navigationTriggerLabel?: string
    skipLinkLabel?: string
}): React.JSX.Element {
    return (
        <TooltipProvider>
            <SidebarProvider>
                <a
                    className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
                    href="#main-content"
                >
                    {skipLinkLabel}
                </a>
                <Sidebar collapsible="offcanvas">
                    <SidebarHeader className="border-b p-4">{brand}</SidebarHeader>
                    <SidebarContent className="px-2 py-3">{navigation}</SidebarContent>
                    {footer !== undefined ? (
                        <SidebarFooter className="border-t p-3">{footer}</SidebarFooter>
                    ) : null}
                </Sidebar>
                {/* Plain div (not SidebarInset, which renders <main>): the
                    skip-link target below is the single main landmark. */}
                <div className="relative flex w-full flex-1 flex-col bg-background">
                    <div className="sticky top-0 z-30 flex h-12 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
                        <SidebarTrigger aria-label={navigationTriggerLabel} />
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
