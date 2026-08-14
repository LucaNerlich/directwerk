'use client'

import {Menu} from 'lucide-react'
import type {ReactNode} from 'react'

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
    children,
    className,
}: {
    brand: ReactNode
    navigation: ReactNode
    mobileNavigation?: ReactNode
    actions?: ReactNode
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <div className={cn('min-h-screen bg-background', className)}>
            <a
                className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
                href="#main-content"
            >
                Zum Inhalt springen
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
                    <Sheet>
                        <SheetTrigger
                            render={
                                <Button
                                    aria-label="Menü öffnen"
                                    className="ml-auto md:hidden"
                                    size="icon"
                                    variant="outline"
                                />
                            }
                        >
                            <Menu />
                        </SheetTrigger>
                        <SheetContent className="w-[min(22rem,88vw)]" side="right">
                            <SheetHeader>
                                <SheetTitle>{brand}</SheetTitle>
                                <SheetDescription>Navigation</SheetDescription>
                            </SheetHeader>
                            <nav className="flex flex-col gap-1 px-4">
                                {mobileNavigation ?? navigation}
                            </nav>
                            {actions !== undefined ? (
                                <div className="mt-auto flex flex-col gap-2 border-t p-4">
                                    {actions}
                                </div>
                            ) : null}
                        </SheetContent>
                    </Sheet>
                </div>
            </header>
            <main id="main-content">{children}</main>
        </div>
    )
}
