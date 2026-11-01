'use client'

import {Menu} from 'lucide-react'
import {useEffect, useRef, useState, type ReactNode} from 'react'

import {Button} from '#components/button'
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '#components/sheet'
import {cn} from '#lib/utils'

export default function SiteShell({
    brand,
    navigation,
    mobileNavigation,
    actions,
    mobileActions,
    children,
    className,
    skipLinkLabel = 'Zum Inhalt springen',
    navigationTriggerLabel = 'Menü öffnen',
    navigationLabel = 'Navigation',
    navigationCloseSignal,
    navigationOpen,
    onNavigationOpenChange,
}: {
    brand: ReactNode
    navigation: ReactNode
    mobileNavigation?: ReactNode
    actions?: ReactNode
    /** Sheet footer actions; falls back to `actions` when omitted. */
    mobileActions?: ReactNode
    children: ReactNode
    className?: string
    /** Visible-on-focus skip link text. */
    skipLinkLabel?: string
    /** Accessible name of the mobile menu trigger. */
    navigationTriggerLabel?: string
    /** Title of the mobile navigation sheet. */
    navigationLabel?: string
    /** When this value changes, the mobile sheet closes (e.g. pathname). */
    navigationCloseSignal?: string
    /** Controlled open state for the mobile sheet. */
    navigationOpen?: boolean
    onNavigationOpenChange?: (open: boolean) => void
}): React.JSX.Element {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
    const controlled = onNavigationOpenChange !== undefined
    const open = controlled ? Boolean(navigationOpen) : uncontrolledOpen
    const setOpen = controlled ? onNavigationOpenChange : setUncontrolledOpen
    const sheetActions = mobileActions ?? actions
    const previousCloseSignal = useRef(navigationCloseSignal)

    useEffect(() => {
        if (previousCloseSignal.current === navigationCloseSignal) {
            return
        }
        previousCloseSignal.current = navigationCloseSignal
        setOpen(false)
    }, [navigationCloseSignal, setOpen])

    function closeOnAnchorClick(event: React.MouseEvent<HTMLElement>): void {
        const target = event.target
        if (!(target instanceof Element)) {
            return
        }
        if (target.closest('a') !== null) {
            setOpen(false)
        }
    }

    return (
        <div className={cn('min-h-screen bg-background', className)}>
            <a
                className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
                href="#main-content"
            >
                {skipLinkLabel}
            </a>
            <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
                    <div className="min-w-0 shrink-0">{brand}</div>
                    <nav className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
                        {navigation}
                    </nav>
                    <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
                        {actions}
                    </div>
                    <Sheet open={open} onOpenChange={setOpen}>
                        <SheetTrigger
                            render={
                                <Button
                                    aria-label={navigationTriggerLabel}
                                    className="ml-auto md:hidden"
                                    size="icon"
                                    variant="outline"
                                />
                            }
                        >
                            <Menu />
                        </SheetTrigger>
                        <SheetContent className="w-[min(22rem,88vw)]" side="right">
                            <div
                                className="flex min-h-0 flex-1 flex-col gap-4"
                                onClick={closeOnAnchorClick}
                            >
                                <SheetHeader>
                                    <SheetTitle>{brand}</SheetTitle>
                                    <SheetDescription>{navigationLabel}</SheetDescription>
                                </SheetHeader>
                                <nav className="flex flex-col gap-1 px-4">
                                    {mobileNavigation ?? navigation}
                                </nav>
                                {sheetActions !== undefined ? (
                                    <div className="mt-auto flex flex-col gap-2 border-t p-4">
                                        {sheetActions}
                                    </div>
                                ) : null}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </header>
            <main id="main-content" tabIndex={-1}>{children}</main>
        </div>
    )
}
