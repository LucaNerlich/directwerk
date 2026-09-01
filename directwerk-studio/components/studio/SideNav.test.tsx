import {cleanup, render, screen} from '@testing-library/react'
import type {ReactNode} from 'react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import SideNav from '@/components/studio/SideNav'
import type {Me, SiteConfig} from '@directwerk/api/types'
import {MeProvider} from '@/lib/auth/MeProvider'

let currentPathname = '/'

vi.mock('next/navigation', () => ({
    usePathname: () => currentPathname,
    useRouter: () => ({replace: vi.fn()}),
}))
vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))

beforeEach(() => {
    currentPathname = '/'
    window.sessionStorage.clear()
})

afterEach(cleanup)

function renderNavigation(children: ReactNode): void {
    render(children)
}

function config(overrides: Partial<SiteConfig> = {}): SiteConfig {
    return {
        tenant: {slug: 'tenant', name: 'Tenant'},
        enabledModules: ['PODCAST'],
        branding: {siteTitle: null, primaryColor: null, secondaryColor: null, logoUrl: null},
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
    }
}

function editorMe(): Me {
    return {
        email: 'editor@example.com',
        name: 'Editor',
        roles: ['EDITOR'],
        tenantId: 1,
    }
}

describe('SideNav', () => {
    it('puts Formate under Podcast desk, not Abos', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.getByRole('link', {name: 'Formate'})).toHaveAttribute(
            'href',
            '/podcast/formats',
        )
        expect(screen.getByRole('navigation').textContent).toMatch(/Podcast/)
        expect(screen.getByRole('navigation').textContent).not.toMatch(
            /Podcast · Einrichtung/,
        )
        expect(screen.queryByRole('link', {name: 'Kategorien'})).not.toBeInTheDocument()
    })

    it('shows Bonusdateien with the Write desk when BONUS_CONTENT is enabled', () => {
        renderNavigation(
            <SideNav
                config={config({
                    enabledModules: ['DIGITAL_CONTENT', 'BONUS_CONTENT'],
                    studioDesks: ['WRITE'],
                })}
            />,
        )
        expect(screen.getByRole('link', {name: 'Bonusdateien'})).toHaveAttribute(
            'href',
            '/write/bonus',
        )
    })

    it('shows Kategorien only when DIGITAL_CONTENT is enabled', () => {
        renderNavigation(
            <SideNav
                config={config({
                    enabledModules: ['PODCAST', 'DIGITAL_CONTENT'],
                })}
            />,
        )
        expect(screen.getByRole('link', {name: 'Kategorien'})).toHaveAttribute(
            'href',
            '/manage/categories',
        )
    })

    it('prioritizes Folgen under podcast create', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.getByRole('link', {name: 'Folgen'})).toHaveAttribute(
            'href',
            '/podcast/episodes',
        )
        expect(screen.getByRole('link', {name: 'Import'})).toHaveAttribute(
            'href',
            '/podcast/import',
        )
        expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute(
            'href',
            '/podcast',
        )
        expect(screen.getByRole('link', {name: 'Sendungen'})).toHaveAttribute(
            'href',
            '/podcast/series',
        )
    })

    it('links to the Feeds page in podcast setup when RSS is enabled', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.getByRole('link', {name: 'Feeds'})).toHaveAttribute(
            'href',
            '/podcast/feeds',
        )
    })

    it('does not show the Feeds link when publicRssUrl is null', () => {
        renderNavigation(<SideNav config={config({publicRssUrl: null})} />)
        expect(screen.queryByRole('link', {name: 'Feeds'})).not.toBeInTheDocument()
    })

    it('does not show Formate link when PODCAST is not in studioDesks', () => {
        renderNavigation(<SideNav config={config({studioDesks: []})} />)
        expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
    })

    it('shows Abos links only when SUBSCRIPTION is enabled', () => {
        renderNavigation(
            <MeProvider me={adminMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'SUBSCRIPTION'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.getByRole('link', {name: 'Zahlungen'})).toHaveAttribute(
            'href',
            '/manage',
        )
        expect(screen.getByRole('link', {name: 'Produkte'})).toHaveAttribute(
            'href',
            '/manage/products',
        )
        expect(screen.getByRole('link', {name: 'Abonnenten'})).toHaveAttribute(
            'href',
            '/manage/subscribers',
        )
        expect(screen.getByRole('link', {name: 'Freischaltungen'})).toHaveAttribute(
            'href',
            '/manage/grants',
        )
    })

    it('hides Abos admin links for EDITOR even when SUBSCRIPTION is on', () => {
        renderNavigation(
            <MeProvider me={editorMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'SUBSCRIPTION'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.queryByRole('link', {name: 'Zahlungen'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Produkte'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Freischaltungen'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Abonnenten'})).not.toBeInTheDocument()
        expect(screen.queryByText('Abos')).not.toBeInTheDocument()
    })

    it('hides Abos group when SUBSCRIPTION is off', () => {
        renderNavigation(<SideNav config={config()} />)
        expect(screen.queryByRole('link', {name: 'Produkte'})).not.toBeInTheDocument()
        expect(screen.queryByText('Abos')).not.toBeInTheDocument()
    })

    it('shows Settings and Team links for TENANT_ADMIN', () => {
        renderNavigation(
            <MeProvider me={adminMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'STRIPE_BILLING'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.getByRole('link', {name: 'Branding'})).toHaveAttribute(
            'href',
            '/settings/branding',
        )
        expect(screen.getByRole('link', {name: 'Domains'})).toHaveAttribute(
            'href',
            '/settings/domains',
        )
        expect(screen.getByRole('link', {name: 'Stripe'})).toHaveAttribute(
            'href',
            '/settings/stripe',
        )
        expect(screen.getByRole('link', {name: 'Mitglieder'})).toHaveAttribute(
            'href',
            '/team',
        )
    })

    it('hides Stripe settings when STRIPE_BILLING is off', () => {
        renderNavigation(
            <MeProvider me={adminMe()}>
                <SideNav config={config()} />
            </MeProvider>,
        )
        expect(screen.getByRole('link', {name: 'Branding'})).toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Stripe'})).not.toBeInTheDocument()
    })

    it('shows media library and email templates for TENANT_ADMIN with modules', () => {
        renderNavigation(
            <MeProvider me={adminMe()}>
                <SideNav
                    config={config({
                        enabledModules: ['PODCAST', 'SUBSCRIPTION', 'EMAIL_NOTIFY'],
                    })}
                />
            </MeProvider>,
        )
        expect(screen.getByRole('link', {name: 'Bibliothek'})).toHaveAttribute(
            'href',
            '/media',
        )
        expect(screen.getByRole('link', {name: 'E-Mail-Vorlagen'})).toHaveAttribute(
            'href',
            '/settings/email',
        )
    })

    it('hides Settings and Team links for EDITOR', () => {
        renderNavigation(
            <MeProvider me={editorMe()}>
                <SideNav config={config()} />
            </MeProvider>,
        )
        expect(screen.queryByRole('link', {name: 'Branding'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Domains'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Mitglieder'})).not.toBeInTheDocument()
        expect(screen.queryByRole('link', {name: 'Abonnenten'})).not.toBeInTheDocument()
    })

    describe('desk-scoped navigation', () => {
        const hybridConfig = config({
            enabledModules: ['DIGITAL_CONTENT', 'PODCAST', 'BONUS_CONTENT'],
            studioDesks: ['WRITE', 'PODCAST'],
            studioHome: 'OVERVIEW',
        })

        it('shows only Write desk groups and shared items when on /write/*', () => {
            currentPathname = '/write/articles'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.getByRole('link', {name: 'Studio'})).toHaveAttribute('href', '/')
            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/write/articles',
            )
            expect(screen.getByRole('link', {name: 'Bonusdateien'})).toHaveAttribute(
                'href',
                '/write/bonus',
            )
            expect(screen.getByRole('link', {name: 'Bibliothek'})).toHaveAttribute(
                'href',
                '/media',
            )
            expect(screen.getByRole('link', {name: 'Kategorien'})).toHaveAttribute(
                'href',
                '/manage/categories',
            )

            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Import'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Sendungen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Feeds'})).not.toBeInTheDocument()
        })

        it('shows only Podcast desk groups and shared items when on /podcast/*', () => {
            currentPathname = '/podcast/episodes'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.getByRole('link', {name: 'Studio'})).toHaveAttribute('href', '/')
            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute(
                'href',
                '/podcast',
            )
            expect(screen.getByRole('link', {name: 'Folgen'})).toHaveAttribute(
                'href',
                '/podcast/episodes',
            )
            expect(screen.getByRole('link', {name: 'Import'})).toHaveAttribute(
                'href',
                '/podcast/import',
            )
            expect(screen.getByRole('link', {name: 'Sendungen'})).toHaveAttribute(
                'href',
                '/podcast/series',
            )
            expect(screen.getByRole('link', {name: 'Formate'})).toHaveAttribute(
                'href',
                '/podcast/formats',
            )
            expect(screen.getByRole('link', {name: 'Feeds'})).toHaveAttribute(
                'href',
                '/podcast/feeds',
            )
            expect(screen.getByRole('link', {name: 'Bibliothek'})).toHaveAttribute(
                'href',
                '/media',
            )

            expect(screen.queryByRole('link', {name: 'Beiträge'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Bonusdateien'})).not.toBeInTheDocument()
        })

        it('restores the last active desk on shared routes for hybrid tenants', () => {
            window.sessionStorage.setItem('directwerk-studio:last-desk', 'WRITE')
            currentPathname = '/media'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/write/articles',
            )
            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
        })

        it('shows Write desk and Verwaltung when hybrid tenant is on /', () => {
            currentPathname = '/'
            renderNavigation(<SideNav config={hybridConfig} />)

            expect(screen.getByRole('link', {name: 'Studio'})).toHaveAttribute('href', '/')
            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/write/articles',
            )
            expect(screen.getByRole('link', {name: 'Bonusdateien'})).toHaveAttribute(
                'href',
                '/write/bonus',
            )
            expect(screen.getByRole('link', {name: 'Bibliothek'})).toHaveAttribute(
                'href',
                '/media',
            )
            expect(screen.getByRole('link', {name: 'Kategorien'})).toHaveAttribute(
                'href',
                '/manage/categories',
            )
            expect(screen.getByText('Verwaltung')).toBeInTheDocument()

            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Sendungen'})).not.toBeInTheDocument()
            expect(screen.queryByRole('link', {name: 'Formate'})).not.toBeInTheDocument()
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

            expect(screen.getByRole('link', {name: 'Start'})).toHaveAttribute('href', '/write')
            expect(screen.getByRole('link', {name: 'Beiträge'})).toHaveAttribute(
                'href',
                '/write/articles',
            )
            expect(screen.getByRole('link', {name: 'Bonusdateien'})).toHaveAttribute(
                'href',
                '/write/bonus',
            )
            expect(screen.queryByRole('link', {name: 'Folgen'})).not.toBeInTheDocument()
        })
    })
})
