import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import DevelopersPage from '@/app/developers/page'

describe('DevelopersPage', () => {
    it('shows API pitch, highlights, curl example, and coming-soon notice', () => {
        render(<DevelopersPage />)

        expect(
            screen.getByRole('heading', {name: /Die API ist das Produkt/}),
        ).toBeInTheDocument()
        expect(
            screen.getByText('/api/v1/public/site-config'),
        ).toBeInTheDocument()
        expect(screen.getByText('GET /api/v1/public/site-config')).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {
                name: /Vollständige API-Dokumentation folgt/,
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'OAuth-Token-Beispiel anzeigen'}),
        ).toBeInTheDocument()
    })
})
