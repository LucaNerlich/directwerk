'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import {cn} from '@directwerk/ui/lib/utils'

import {DOCS_URL} from '@/lib/marketing/constants'

const PLATFORM_LINKS = [
    {href: '/#features', label: 'Plattform', description: 'Studio, Portal & Module'},
    {href: '/privacy', label: 'Datenschutz', description: 'EU-Hosting & DSGVO'},
    {href: '/#feeds', label: 'Feeds', description: 'Privat & pro Hörer'},
    {href: '/#products', label: 'Produkte', description: 'Studio, Web & API'},
] as const

function LogoMark(): React.JSX.Element {
    return (
        <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
        >
            <svg
                className="h-4 w-4"
                fill="currentColor"
                viewBox="0 0 16 16"
            >
                <rect height="6" rx="1" width="2.4" x="0.8" y="5" />
                <rect height="12" rx="1" width="2.4" x="4.6" y="2" />
                <rect height="8" rx="1" width="2.4" x="8.4" y="4" />
                <rect height="5" rx="1" width="2.4" x="12.2" y="5.5" />
            </svg>
        </span>
    )
}

function ExternalIcon({className}: {className?: string}): React.JSX.Element {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
        </svg>
    )
}

function Brand(): React.JSX.Element {
    return (
        <Link
            aria-label="Directwerk – Startseite"
            className="flex min-w-0 items-center gap-2.5 rounded-lg"
            href="/"
        >
            <LogoMark />
            <span className="flex min-w-0 flex-col leading-none">
                <span className="truncate text-[17px] font-semibold tracking-tight">
                    Directwerk
                </span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    EU Podcast Cloud
                </span>
            </span>
            <span className="glass-chip ml-1 hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-block">
                Alpha
            </span>
        </Link>
    )
}

export default function MarketingHeader(): React.JSX.Element {
    const pathname = usePathname()
    const [scrolled, setScrolled] = useState(false)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        const onScroll = (): void => {
            setScrolled(window.scrollY > 8)
        }
        onScroll()
        window.addEventListener('scroll', onScroll, {passive: true})
        return () => {
            window.removeEventListener('scroll', onScroll)
        }
    }, [])

    // Close the mobile panel on route change and on Escape.
    useEffect(() => {
        setOpen(false)
    }, [pathname])

    useEffect(() => {
        if (!open) {
            return
        }
        const onKey = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('keydown', onKey)
        }
    }, [open])

    const isDevelopers = pathname.startsWith('/developers')

    return (
        <>
            <div className="bg-primary text-primary-foreground">
                <div className="marketing-container flex min-h-9 items-center justify-center gap-2 py-1.5 text-center text-[13px] leading-5">
                    <span
                        aria-hidden="true"
                        className="hidden size-1.5 rounded-full bg-current opacity-70 sm:inline-block"
                    />
                    <p className="truncate">
                        Alpha-Onboarding für erste Creator — EU-Hosting · DSGVO-konform
                    </p>
                    <a
                        className="shrink-0 font-semibold underline underline-offset-4 hover:opacity-85"
                        href="/#contact"
                    >
                        Platz anfragen
                    </a>
                </div>
            </div>
            <header
                className={cn(
                    'marketing-header sticky top-0 z-40 backdrop-blur-xl',
                    scrolled
                        ? 'border-b border-border bg-background/85 shadow-[0_12px_32px_-20px_color-mix(in_srgb,var(--foreground)_35%,transparent)]'
                        : 'border-b border-transparent bg-background/60',
                )}
            >
                <div className="marketing-container flex h-16 items-center gap-3">
                    <Brand />
                    <nav
                        aria-label="Hauptnavigation"
                        className="mx-auto hidden items-center gap-0.5 rounded-full border border-foreground/10 bg-card/60 p-1 backdrop-blur lg:flex"
                    >
                        {PLATFORM_LINKS.map((item) => (
                            <Link
                                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
                                href={item.href}
                                key={item.href}
                            >
                                {item.label}
                            </Link>
                        ))}
                        <Link
                            aria-current={isDevelopers ? 'page' : undefined}
                            className={cn(
                                'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                                isDevelopers
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                            )}
                            href="/developers"
                        >
                            Entwickler
                        </Link>
                        <span
                            aria-hidden="true"
                            className="mx-1 h-4 w-px bg-foreground/15"
                        />
                        <a
                            className="flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
                            href={DOCS_URL}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            Dokumentation
                            <ExternalIcon className="size-3.5 opacity-70" />
                        </a>
                    </nav>
                    <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex lg:ml-0">
                        <a
                            className={buttonVariants()}
                            href="/#contact"
                        >
                            Gespräch vereinbaren
                        </a>
                    </div>
                    <Button
                        aria-controls="marketing-mobile-nav"
                        aria-expanded={open}
                        aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
                        className="ml-auto lg:hidden"
                        onClick={() => {
                            setOpen((value) => !value)
                        }}
                        size="icon"
                        variant="outline"
                    >
                        <svg
                            aria-hidden="true"
                            className="size-5"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                        >
                            {open ? (
                                <path d="M6 6l12 12M18 6 6 18" />
                            ) : (
                                <path d="M4 7h16M4 12h16M4 17h16" />
                            )}
                        </svg>
                    </Button>
                </div>
                {open ? (
                    <div
                        className="border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
                        id="marketing-mobile-nav"
                    >
                        <nav
                            aria-label="Mobile Navigation"
                            className="marketing-container marketing-mobile-panel grid gap-6 py-5"
                        >
                            <div>
                                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Plattform
                                </p>
                                <ul className="mt-2 grid gap-1">
                                    {PLATFORM_LINKS.map((item) => (
                                        <li key={item.href}>
                                            <a
                                                className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/70"
                                                href={item.href}
                                                onClick={() => {
                                                    setOpen(false)
                                                }}
                                            >
                                                <span className="text-[15px] font-medium">
                                                    {item.label}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {item.description}
                                                </span>
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    Entwickler
                                </p>
                                <ul className="mt-2 grid gap-1">
                                    <li>
                                        <Link
                                            aria-current={isDevelopers ? 'page' : undefined}
                                            className={cn(
                                                'flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors',
                                                isDevelopers
                                                    ? 'bg-primary font-medium text-primary-foreground'
                                                    : 'hover:bg-accent/70',
                                            )}
                                            href="/developers"
                                            onClick={() => {
                                                setOpen(false)
                                            }}
                                        >
                                            <span className="text-[15px] font-medium">
                                                Entwickler
                                            </span>
                                            <span
                                                className={cn(
                                                    'text-xs',
                                                    isDevelopers
                                                        ? 'text-primary-foreground/80'
                                                        : 'text-muted-foreground',
                                                )}
                                            >
                                                REST-API & OpenAPI
                                            </span>
                                        </Link>
                                    </li>
                                    <li>
                                        <a
                                            className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/70"
                                            href={DOCS_URL}
                                            rel="noopener noreferrer"
                                            target="_blank"
                                        >
                                            <span className="flex items-center gap-1.5 text-[15px] font-medium">
                                                Dokumentation
                                                <ExternalIcon className="size-3.5 opacity-70" />
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                Guides & Referenz
                                            </span>
                                        </a>
                                    </li>
                                </ul>
                            </div>
                            <Button
                                className="w-full"
                                onClick={() => {
                                    setOpen(false)
                                }}
                                render={<a href="/#contact" />}
                                size="lg"
                            >
                                Gespräch vereinbaren
                            </Button>
                        </nav>
                    </div>
                ) : null}
            </header>
        </>
    )
}
