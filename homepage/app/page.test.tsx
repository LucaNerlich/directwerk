import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('@/components/marketing/AltchaWidget', () => ({
    default: ({
        onVerifiedChange,
    }: {
        onVerifiedChange?: (verified: boolean) => void
    }) => (
        <div>
            <input name="altcha" readOnly value="test-payload" />
            <button onClick={() => onVerifiedChange?.(true)} type="button">
                Verify captcha
            </button>
        </div>
    ),
}))

import Home from '@/app/page'

afterEach(() => cleanup())

describe('Home', () => {
    it('introduces the platform with navigation and developer path', () => {
        render(<Home />)

        expect(
            screen.getByRole('heading', {name: /Deine Inhalte/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'API-Auszug ansehen'}),
        ).toHaveAttribute('href', '/developers')
        expect(screen.getAllByRole('link', {name: 'Dokumentation'}).length).toBeGreaterThan(0)
        expect(screen.getByRole('link', {name: 'Kontakt'})).toHaveAttribute('href', '#contact')
        expect(screen.getByRole('heading', {name: /Eigene Publishing-Infrastruktur/})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Nachricht senden'})).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Datenschutz ist das Feature/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Ein RSS-Feed pro Hörer/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Kurz beantwortet/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Private Feeds ansehen'}),
        ).toHaveAttribute('href', '#feeds')
    })

    it('lets visitors try the feed builder demo', () => {
        render(<Home />)

        expect(screen.getByText(/Persönliche Feed-URL/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Bonus'}))
        expect(screen.getByText(/2 von 3 Formaten/)).toBeInTheDocument()
    })
})
