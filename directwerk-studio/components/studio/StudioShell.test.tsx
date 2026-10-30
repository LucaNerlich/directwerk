import {cleanup, screen} from '@testing-library/react'
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

function config(): SiteConfig {
    return {
        tenant: {slug: 'acme', name: 'Acme Podcast'},
        enabledModules: ['PODCAST'],
        branding: {
            siteTitle: null,
            primaryColor: null,
            secondaryColor: null,
            logoUrl: null,
            faviconUrl: null,
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
        expect(home.className).toContain('group-data-[collapsible=icon]:flex')
    })
})
