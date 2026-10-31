import {fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

import {TestLocale} from '@/lib/i18n/testWrapper'

import SiteHeader from './SiteHeader'

vi.mock('next/navigation', () => ({
    usePathname: () => '/de/articles',
    useRouter: () => ({replace: vi.fn()}),
}))

afterEach(() => {
    window.localStorage.clear()
})

describe('SiteHeader', () => {
    it('renders the shared accessible shell and module-gated navigation', () => {
        render(
            <TestLocale><SiteConfigProvider
                config={{
                    tenant: {slug: 'journal', name: 'Journal'},
                    enabledModules: ['DIGITAL_CONTENT'],
                    branding: {
                        siteTitle: 'The Journal',
                        primaryColor: null,
                        secondaryColor: null,
                        logoUrl: null,
                        faviconUrl: null,
                    },
                    publicSiteUrl: null,
                    publicRssUrl: null,
                    publicArticleRssUrl: null,
                    analytics: null,
                    emailNotifyAvailable: false,
                }}
            >
                <SiteHeader>
                    <p>Page content</p>
                </SiteHeader>
            </SiteConfigProvider></TestLocale>,
        )

        expect(screen.getByText('Zum Inhalt springen')).toHaveAttribute(
            'href',
            '#main-content',
        )
        expect(screen.getAllByRole('link', {name: 'Beiträge'})[0]).toHaveAttribute(
            'aria-current',
            'page',
        )
        expect(screen.queryByRole('link', {name: 'Podcast'})).not.toBeInTheDocument()
        expect(screen.getByRole('main')).toHaveTextContent('Page content')

        fireEvent.click(screen.getByRole('button', {name: 'Menü öffnen'}))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('toggles light/dark theme from the header control', () => {
        document.documentElement.classList.add('light')
        render(
            <TestLocale>
                <SiteConfigProvider
                    config={{
                        tenant: {slug: 'journal', name: 'Journal'},
                        enabledModules: ['DIGITAL_CONTENT'],
                        branding: {
                            siteTitle: 'The Journal',
                            primaryColor: null,
                            secondaryColor: null,
                            logoUrl: null,
                            faviconUrl: null,
                        },
                        publicSiteUrl: null,
                        publicRssUrl: null,
                        publicArticleRssUrl: null,
                        analytics: null,
                        emailNotifyAvailable: false,
                    }}
                >
                    <SiteHeader>
                        <p>Page content</p>
                    </SiteHeader>
                </SiteConfigProvider>
            </TestLocale>,
        )

        // Actions render in desktop header + mobile sheet; either toggle is fine.
        fireEvent.click(screen.getAllByRole('button', {name: 'Zum dunklen Modus wechseln'})[0]!)
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(window.localStorage.getItem('dw.web.theme')).toBe('dark')

        fireEvent.click(screen.getAllByRole('button', {name: 'Zum hellen Modus wechseln'})[0]!)
        expect(document.documentElement.classList.contains('light')).toBe(true)
        expect(window.localStorage.getItem('dw.web.theme')).toBe('light')
    })
})
