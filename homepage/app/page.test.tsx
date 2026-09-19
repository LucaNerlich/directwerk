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
        expect(
            screen.getByRole('link', {name: 'Vollständige Docs'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Nachricht senden'})).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Jeder Hörer bekommt seinen eigenen Feed/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {name: /Kurz beantwortet/}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Private Feeds'}),
        ).toHaveAttribute('href', '#feeds')
        expect(
            screen.queryByRole('heading', {name: /Datenschutz von Anfang an/}),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: /Was heute schon drin ist/}),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByRole('heading', {name: /Vom ersten Setup bis zum privaten Feed/}),
        ).not.toBeInTheDocument()
    })

    it('lets visitors try the feed builder demo', () => {
        render(<Home />)

        expect(screen.getByText(/Persönliche Feed-URL/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', {name: 'Bonus'}))
        expect(screen.getByText(/2 von 3 Formaten/)).toBeInTheDocument()
    })
})
