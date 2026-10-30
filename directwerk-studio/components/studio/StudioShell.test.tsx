import {cleanup, fireEvent, screen} from '@testing-library/react'
import type {ReactNode} from 'react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import StudioShell from '@/components/studio/StudioShell'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import type {SiteConfig} from '@directwerk/api/types'

vi.mock('next/navigation', () => ({
    usePathname: () => '/de',
    useRouter: () => ({replace: vi.fn()}),
}))
vi.mock('next/link', () => ({
    default: ({
        children,
        href,
        ...props
    }: {
        children?: ReactNode
        href: string
        [key: string]: unknown
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}))
vi.mock('@directwerk/ui/components/layout/app-shell', () => ({
    default: ({brand, children}: {brand: ReactNode; children: ReactNode}) => (
        <div>
            <div data-testid="brand">{brand}</div>
            {children}
        </div>
    ),
}))
vi.mock('@/components/studio/DeskSwitcher', () => ({default: () => null}))
vi.mock('@/components/studio/SideNav', () => ({default: () => null}))
vi.mock('@/components/studio/LogoutButton', () => ({default: () => null}))

afterEach(cleanup)

function config(overrides: Partial<SiteConfig['branding']> = {}): SiteConfig {
    return {
        tenant: {slug: 'acme', name: 'Acme Podcast'},
        enabledModules: ['PODCAST'],
        branding: {
            siteTitle: null,
            primaryColor: null,
            secondaryColor: null,
            logoUrl: null,
            faviconUrl: null,
            ...overrides,
        },
        publicSiteUrl: 'http://localhost:3000',
        publicRssUrl: 'http://localhost:8080/feeds/acme/podcast.xml',
        publicArticleRssUrl: null,
        studioHome: 'PODCAST_DESK',
        studioDesks: ['PODCAST'],
        analytics: null,
        emailNotifyAvailable: false,
    }
}

describe('StudioShell', () => {
    it('links the tenant brand to desk home, including a collapsed initial', () => {
        renderWithLocale(
            <StudioShell config={config()}>
                <div>content</div>
            </StudioShell>,
        )

        const home = screen.getByRole('link', {name: 'Acme Podcast'})
        expect(home).toHaveAttribute('href', '/de')
        expect(home).toHaveTextContent('A')
        expect(home.className).toContain('group-data-[collapsible=icon]:size-8')
    })

    it('prefers favicon over logo next to the tenant name', () => {
        renderWithLocale(
            <StudioShell
                config={config({
                    faviconUrl: 'https://cdn.example.test/favicon.ico',
                    logoUrl: 'https://cdn.example.test/logo.png',
                })}
            >
                <div>content</div>
            </StudioShell>,
        )

        const home = screen.getByRole('link', {name: 'Acme Podcast'})
        const mark = home.querySelector('img')
        expect(mark).not.toBeNull()
        expect(mark).toHaveAttribute('src', 'https://cdn.example.test/favicon.ico')
        expect(mark).toHaveAttribute('alt', '')
        expect(home).toHaveTextContent('Acme Podcast')
    })

    it('falls back to logo when favicon is missing', () => {
        renderWithLocale(
            <StudioShell
                config={config({
                    logoUrl: 'https://cdn.example.test/logo.png',
                })}
            >
                <div>content</div>
            </StudioShell>,
        )

        const mark = screen.getByRole('link', {name: 'Acme Podcast'}).querySelector('img')
        expect(mark).toHaveAttribute('src', 'https://cdn.example.test/logo.png')
    })

    it('falls back to the tenant initial when branding images are missing', () => {
        renderWithLocale(
            <StudioShell config={config()}>
                <div>content</div>
            </StudioShell>,
        )

        const home = screen.getByRole('link', {name: 'Acme Podcast'})
        expect(home.querySelector('img')).toBeNull()
        expect(home).toHaveTextContent('A')
    })

    it('falls back to the tenant initial when the branding image fails to load', () => {
        renderWithLocale(
            <StudioShell
                config={config({
                    faviconUrl: 'https://cdn.example.test/broken.ico',
                })}
            >
                <div>content</div>
            </StudioShell>,
        )

        const home = screen.getByRole('link', {name: 'Acme Podcast'})
        const mark = home.querySelector('img')
        expect(mark).not.toBeNull()
        fireEvent.error(mark!)
        expect(home.querySelector('img')).toBeNull()
        expect(home).toHaveTextContent('A')
    })
})
