import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react'
import type {ReactNode} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {SidebarProvider, useSidebar} from '@directwerk/ui/components/sidebar'

import SideNav from '@/components/studio/SideNav'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import type {Me, SiteConfig} from '@directwerk/api/types'
import {MeProvider} from '@/lib/auth/MeProvider'

let currentPathname = '/'

vi.mock('next/navigation', () => ({
    usePathname: () => currentPathname,
    useRouter: () => ({replace: vi.fn()}),
}))
vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        onClick,
        ...rest
    }: {
        children: React.ReactNode
        href: string
        onClick?: React.MouseEventHandler<HTMLAnchorElement>
    } & Record<string, unknown>) => (
        <a
            href={href}
            onClick={(event) => {
                event.preventDefault()
                onClick?.(event)
            }}
            {...rest}
        >
            {children}
        </a>
    ),
}))

beforeEach(() => {
    currentPathname = '/'
    window.localStorage.clear()
    window.sessionStorage.clear()
})

afterEach(cleanup)

function MobileOpenProbe(): React.JSX.Element {
    const {openMobile, setOpenMobile} = useSidebar()
    return (
        <>
            <button onClick={() => setOpenMobile(true)} type="button">
                open-mobile
            </button>
            <span data-testid="mobile-open">{openMobile ? 'yes' : 'no'}</span>
        </>
    )
}

function renderNavigation(children: ReactNode): void {
    renderWithLocale(<SidebarProvider>{children}</SidebarProvider>)
}

function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
    return {
        tenant: {slug: 'tenant', name: 'Tenant'},
        enabledModules: ['PODCAST'],
        branding: {siteTitle: null, primaryColor: null, secondaryColor: null, logoUrl: null, faviconUrl: null},
        publicSiteUrl: 'http://localhost:3000',
        publicRssUrl: 'http://localhost:8080/feeds/tenant/podcast.xml',
        publicArticleRssUrl: null,
        studioHome: 'PODCAST_DESK',
        studioDesks: ['PODCAST'],
        analytics: null,
        emailNotifyAvailable: false,
        ...overrides,
    }
}

function adminMe(): Me {
    return {
        email: 'admin@example.com',
        name: 'Admin',
        roles: ['TENANT_ADMIN'],
        tenantId: 1,
        userId: 1,
    }
}

function editorMe(): Me {
    return {
        email: 'editor@example.com',
        name: 'Editor',
        roles: ['EDITOR'],
        tenantId: 1,
        userId: 2,
    }
}

function expandMore(): void {
    fireEvent.click(screen.getByRole('button', {name: 'Mehr…'}))
}

describe('SideNav', () => {
    it('closes the mobile sidebar when the pathname changes', async () => {
        function tree(): React.JSX.Element {
            return (
                <SidebarProvider>
                    <MobileOpenProbe />
                    <SideNav config={config()} />
                </SidebarProvider>
            )
        }

        const {rerender} = renderWithLocale(tree())
        fireEvent.click(screen.getByRole('button', {name: 'open-mobile'}))
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('yes')

        // Same route: provider state must survive rerender (not a remount reset).
        rerender(tree())
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('yes')

        currentPathname = '/podcast/episodes'
        rerender(tree())

        await waitFor(() => {
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('no')
        })
    })

    it('closes the mobile sidebar when a nav link is clicked', () => {
        renderNavigation(
            <>
                <MobileOpenProbe />
                <SideNav config={config()} />
            </>,
        )
        fireEvent.click(screen.getByRole('button', {name: 'open-mobile'}))
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('yes')

        fireEvent.click(screen.getByRole('link', {name: 'Folgen'}))
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('no')
    })

    it('keeps the mobile sidebar open when expanding Mehr…', () => {
        renderNavigation(
            <>
                <MobileOpenProbe />
                <SideNav config={config()} />
            </>,
        )
        fireEvent.click(screen.getByRole('button', {name: 'open-mobile'}))
        expandMore()
        expect(screen.getByTestId('mobile-open')).toHaveTextContent('yes')
        expect(screen.getByRole('link', {name: 'Formate'})).toBeInTheDocument()
    })

    it('tucks Formate under Mehr… for the Podcast desk', () => {
        renderNavigation(<SideNav config={config()} />)
        const more = screen.getByRole('button', {name: 'Mehr…'})
        expect(more).toHaveAttribute('title', 'Mehr…')
        expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
        expandMore()
        expect(screen.getByRole('link', {name: 'Formate'})).toHaveAttribute(
            'href',
            '/de/podcast/formats',
        )
        expect(screen.getByRole('navigation').textContent).toMatch(/Podcast/)
        expect(screen.queryByRole('link', {name: 'Kategorien'})).not.toBeInTheDocument()
    })

    it('shows a single Mediathek link in desk primary when media modules are enabled', () => {
        renderNavigation(
            <SideNav
                config={config({
                    enabledModules: ['DIGITAL_CONTENT', 'BONUS_CONTENT'],
                    studioDesks: ['WRITE'],
                })}
            />,
        )
        const mediaLinks = screen.getAllByRole('link', {name: 'Mediathek'})
        expect(mediaLinks).toHaveLength(1)
        expect(mediaLinks[0]).toHaveAttribute('href', '/de/media')
        expect(screen.queryByRole('link', {name: 'Bonusdateien'})).not.toBeInTheDocument()
    })

    it('keeps Mediathek under Verwaltung when no desk would surface it', () => {
        renderNavigation(
            <SideNav
                config={config({
                    enabledModules: ['DIGITAL_CONTENT'],
                    studioDesks: [],
                    studioHome: 'OVERVIEW',
                })}
            />,
        )
        const mediaLinks = screen.getAllByRole('link', {name: 'Mediathek'})
        expect(mediaLinks).toHaveLength(1)
        expect(mediaLinks[0]).toHaveAttribute('href', '/de/media')
        expect(screen.getByText('Verwaltung')).toBeInTheDocument()
    })

    it('hides Mediathek when no media modules are enabled', () => {
        renderNavigation(
            <SideNav
                config={config({
                    enabledModules: [],
                    studioDesks: ['WRITE'],
                })}
            />,
        )
        expect(screen.queryByRole('link', {name: 'Mediathek'})).not.toBeInTheDocument()
    })

    it('prioritizes Folgen under podcast create', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.getByRole('link', {name: 'Folgen'})).toHaveAttribute(
            'href',
            '/de/podcast/episodes',
        )
        expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute(
            'href',
            '/de/podcast',
        )
        expandMore()
        expect(screen.getByRole('link', {name: 'Import'})).toHaveAttribute(
            'href',
            '/de/podcast/import',
        )
        expect(screen.getByRole('link', {name: 'Sendungen'})).toHaveAttribute(
            'href',
            '/de/podcast/series',
        )
    })

    it('links to the Feeds page under Mehr… when RSS is enabled', () => {
        renderNavigation(<SideNav config={config()} />)
        expandMore()
        expect(screen.getByRole('link', {name: 'Feeds'})).toHaveAttribute(
            'href',
            '/de/podcast/feeds',
        )
    })

    it('does not show the Feeds link when publicRssUrl is null', () => {
        renderNavigation(<SideNav config={config({publicRssUrl: null})} />)
        expandMore()
        expect(screen.queryByRole('link', {name: 'Feeds'})).not.toBeInTheDocument()
    })

    it('does not show Formate link when PODCAST is not in studioDesks', () => {
        renderNavigation(<SideNav config={config({studioDesks: []})} />)
        expect(screen.queryByRole('button', {name: 'Mehr…'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
    })

    it('shows a single Abos hub link when SUBSCRIPTION is enabled', () => {
        renderNavigation(
            <MeProvider me={adminMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'SUBSCRIPTION'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.getByRole('link', {name: 'Abos'})).toHaveAttribute('href', '/de/manage')
        expect(screen.queryByRole('link', {name: 'Zahlungen'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Produkte'})).not.toBeInTheDocument()
    })

    it('hides Abos hub for EDITOR even when SUBSCRIPTION is on', () => {
        renderNavigation(
            <MeProvider me={editorMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'SUBSCRIPTION'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.queryByRole('link', {name: 'Abos'})).not.toBeInTheDocument()
    })

    it('hides Abos group when SUBSCRIPTION is off', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.queryByRole('link', {name: 'Abos'})).not.toBeInTheDocument()
    })

    it('shows Statistiken for tenants with content', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.getByRole('link', {name: 'Statistiken'})).toHaveAttribute(
            'href',
            '/de/analytics',
        )
    })

    it('hides Statistiken when the tenant has no desks or modules', () => {
        renderNavigation(
            <SideNav
                config={config({enabledModules: [], studioDesks: []})}
            />,
        )
        expect(screen.queryByRole('link', {name: 'Statistiken'})).not.toBeInTheDocument()
    })

    it('shows Settings and Team hubs for TENANT_ADMIN', () => {
        renderNavigation(
            <MeProvider me={adminMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'STRIPE_BILLING'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.getByRole('link', {name: 'Einstellungen'})).toHaveAttribute(
            'href',
            '/de/settings',
        )
        expect(screen.getByRole('link', {name: 'Team'})).toHaveAttribute('href', '/de/team')
        expect(screen.queryByRole('link', {name: 'Branding'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Stripe'})).not.toBeInTheDocument()
    })

    it('hides Settings and Team links for EDITOR', () => {
        renderNavigation(
            <MeProvider me={editorMe()}>
                <SideNav config={config()} />
            </MeProvider>,
        )
        expect(screen.queryByRole('link', {name: 'Einstellungen'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Team'})).not.toBeInTheDocument()
    })

    describe('desk-scoped navigation', () => {
        const hybridConfig = config({
            enabledModules: ['DIGITAL_CONTENT', 'PODCAST', 'BONUS_CONTENT'],
            studioDesks: ['WRITE', 'PODCAST'],
            studioHome: 'OVERVIEW',
        })

        it('shows only Write desk groups and shared hubs when on /write/*', () => {
            currentPathname = '/write/articles'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.queryByRole('link', {name: 'Studio'})).not.toBeInTheDocument()
            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/de/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/de/write/articles',
            )
            expect(screen.getAllByRole('link', {name: 'Mediathek'})).toHaveLength(1)

            expandMore()
            expect(screen.getByRole('link', {name: 'Import'})).toHaveAttribute(
                'href',
                '/de/write/import',
            )
            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Sendungen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
        })

        it('shows only Podcast desk groups and shared hubs when on /podcast/*', () => {
            currentPathname = '/podcast/episodes'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.queryByRole('link', {name: 'Studio'})).not.toBeInTheDocument()
            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute(
                'href',
                '/de/podcast',
            )
            expect(screen.getByRole('link', {name: 'Folgen'})).toHaveAttribute(
                'href',
                '/de/podcast/episodes',
            )
            expandMore()
            expect(screen.getByRole('link', {name: 'Import'})).toHaveAttribute(
                'href',
                '/de/podcast/import',
            )
            expect(screen.getByRole('link', {name: 'Sendungen'})).toHaveAttribute(
                'href',
                '/de/podcast/series',
            )
            expect(screen.getByRole('link', {name: 'Formate'})).toHaveAttribute(
                'href',
                '/de/podcast/formats',
            )
            expect(screen.getByRole('link', {name: 'Feeds'})).toHaveAttribute(
                'href',
                '/de/podcast/feeds',
            )
            expect(screen.getAllByRole('link', {name: 'Mediathek'})).toHaveLength(1)
            expect(screen.queryByRole('link', {name: 'Beiträge'})).not.toBeInTheDocument()
        })

        it('restores the last active desk on shared routes for hybrid tenants', async () => {
            window.localStorage.setItem('dw.studio.lastDesk:slug:tenant', 'WRITE')
            currentPathname = '/media'
            renderNavigation(<SideNav config={hybridConfig} />)

            await waitFor(() => {
                expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute(
                    'href',
                    '/de/write',
                )
            })
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/de/write/articles',
            )
            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
        })

        it('shows Write desk and Verwaltung when hybrid tenant is on /', () => {
            currentPathname = '/'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.queryByRole('link', {name: 'Studio'})).not.toBeInTheDocument()
            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/de/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/de/write/articles',
            )
            expect(screen.getAllByRole('link', {name: 'Mediathek'})).toHaveLength(1)
            expect(screen.getByText('Verwaltung')).toBeInTheDocument()

            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Sendungen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
        })

        it('restores the remembered Podcast desk on Studio home for hybrid tenants', async () => {
            window.localStorage.setItem('dw.studio.lastDesk:slug:tenant', 'PODCAST')
            currentPathname = '/'
            renderNavigation(<SideNav config={hybridConfig} />)

            await waitFor(() => {
                expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute(
                    'href',
                    '/de/podcast',
                )
            })
            expect(screen.getByRole('link', {name: 'Folgen'})).toHaveAttribute(
                'href',
                '/de/podcast/episodes',
            )
            expect(screen.queryByRole('link', {name: 'Beiträge'})).not.toBeInTheDocument()
        })

        it('keeps the Write desk groups for a single-desk tenant on a shared route', () => {
            currentPathname = '/media'
            renderNavigation(
                <SideNav
                    config={config({
                        enabledModules: ['DIGITAL_CONTENT', 'BONUS_CONTENT'],
                        studioDesks: ['WRITE'],
                        studioHome: 'WRITE_DESK',
                    })}
                />,
            )

            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/de/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/de/write/articles',
            )
            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
        })
    })
})
