import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {LocaleProvider} from '@/components/i18n/LocaleProvider'
import MarketingHeader from '@/components/marketing/MarketingHeader'
import de from '@/dictionaries/de.json'

const {mockPathname} = vi.hoisted(() => ({mockPathname: {value: '/de'}}))

vi.mock('next/navigation', () => ({
    usePathname: () => mockPathname.value,
}))

afterEach(() => {
    cleanup()
    mockPathname.value = '/de'
})

function renderHeader(): void {
    render(
        <LocaleProvider dictionary={de} lang="de">
            <MarketingHeader />
        </LocaleProvider>,
    )
}

describe('MarketingHeader', () => {
    it('renders brand, announcement, nav, CTA, and language switcher', () => {
        renderHeader()

        expect(
            screen.getByRole('link', {name: 'Directwerk – Startseite'}),
        ).toHaveAttribute('href', '/de')
        expect(screen.getByText(/Alpha-Onboarding/)).toBeInTheDocument()
        expect(
            screen.getByRole('navigation', {name: 'Hauptnavigation'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Gespräch vereinbaren'}),
        ).toHaveAttribute('href', '/de/#contact')
        expect(
            screen.getByRole('link', {name: 'Entwickler'}),
        ).not.toHaveAttribute('aria-current')
        expect(screen.getByRole('link', {name: /EN/})).toHaveAttribute('href', '/en')
    })

    it('marks Entwickler active on /de/developers', () => {
        mockPathname.value = '/de/developers'
        renderHeader()

        expect(
            screen.getByRole('link', {name: 'Entwickler'}),
        ).toHaveAttribute('aria-current', 'page')
    })

    it('toggles the mobile navigation', () => {
        renderHeader()

        const toggle = screen.getByRole('button', {name: 'Menü öffnen'})
        expect(
            screen.queryByRole('navigation', {name: 'Mobile Navigation'}),
        ).not.toBeInTheDocument()

        fireEvent.click(toggle)
        expect(
            screen.getByRole('navigation', {name: 'Mobile Navigation'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'Menü schließen'}),
        ).toBeInTheDocument()
    })
})
