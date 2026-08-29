import {fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

import SiteHeader from './SiteHeader'

vi.mock('next/navigation', () => ({
    usePathname: () => '/articles',
    useRouter: () => ({replace: vi.fn()}),
}))

afterEach(() => {
    window.localStorage.clear()
})

describe('SiteHeader', () => {
    it('renders the shared accessible shell and module-gated navigation', () => {
        render(
            <SiteConfigProvider
                config={{
                    tenant: {slug: 'journal', name: 'Journal'},
                    enabledModules: ['DIGITAL_CONTENT'],
                    branding: {
                        siteTitle: 'The Journal',
                        primaryColor: null,
                        secondaryColor: null,
                        logoUrl: null,
                    },
                    publicSiteUrl: null,
                    publicRssUrl: null,
                }}
            >
                <SiteHeader>
                    <p>Page content</p>
                </SiteHeader>
            </SiteConfigProvider>,
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
})
