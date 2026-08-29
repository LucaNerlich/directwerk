import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

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
        expect(screen.getByRole('link', {name: 'Kontakt'})).toHaveAttribute('href', '/#contact')
        expect(screen.getByRole('heading', {name: /Eigene Publishing-Infrastruktur/})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Nachricht senden'})).toBeInTheDocument()
    })
})
