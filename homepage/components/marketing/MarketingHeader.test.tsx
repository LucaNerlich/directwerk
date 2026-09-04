import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import MarketingHeader from '@/components/marketing/MarketingHeader'

const {mockPathname} = vi.hoisted(() => ({mockPathname: {value: '/'}}))

vi.mock('next/navigation', () => ({
    usePathname: () => mockPathname.value,
}))

afterEach(() => {
    cleanup()
    mockPathname.value = '/'
})

describe('MarketingHeader', () => {
    it('renders brand, announcement, nav, and CTA', () => {
        render(<MarketingHeader />)

        expect(
            screen.getByRole('link', {name: 'Directwerk – Startseite'}),
        ).toHaveAttribute('href', '/')
        expect(screen.getByText(/Alpha-Onboarding/)).toBeInTheDocument()
        expect(
            screen.getByRole('navigation', {name: 'Hauptnavigation'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Gespräch vereinbaren'}),
        ).toHaveAttribute('href', '/#contact')
        expect(
            screen.getByRole('link', {name: 'Entwickler'}),
        ).not.toHaveAttribute('aria-current')
    })

    it('marks Entwickler active on /developers', () => {
        mockPathname.value = '/developers'
        render(<MarketingHeader />)

        expect(
            screen.getByRole('link', {name: 'Entwickler'}),
        ).toHaveAttribute('aria-current', 'page')
    })

    it('toggles the mobile navigation', () => {
        render(<MarketingHeader />)

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
