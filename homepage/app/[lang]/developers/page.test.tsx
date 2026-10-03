import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import DevelopersPage from '@/app/[lang]/developers/page'
import {LocaleProvider} from '@/components/i18n/LocaleProvider'
import de from '@/dictionaries/de.json'

describe('DevelopersPage', () => {
    it('shows API pitch, highlights, curl example, and docs CTA', async () => {
        const page = await DevelopersPage({params: Promise.resolve({lang: 'de'})})
        render(
            <LocaleProvider dictionary={de} lang="de">
                {page}
            </LocaleProvider>,
        )

        expect(
            screen.getByRole('heading', {name: /Die API ist das Produkt/}),
        ).toBeInTheDocument()
        expect(
            screen.getByText('/api/v1/public/site-config'),
        ).toBeInTheDocument()
        expect(screen.getByText('GET /api/v1/public/site-config')).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {
                name: /Vollständige Dokumentation/,
            }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('link', {name: 'Dokumentation öffnen'}),
        ).toHaveAttribute('href', 'https://docs.directwerk.org')
        expect(
            screen.getByRole('button', {name: 'OAuth-Token-Beispiel anzeigen'}),
        ).toBeInTheDocument()
    })
})
