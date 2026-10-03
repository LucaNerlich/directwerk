import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {IMPRINT} from '@directwerk/legal'

import LegalArticle from './legal-article'

describe('LegalArticle', () => {
    it('renders title, sections, and update stamp', () => {
        render(<LegalArticle page={IMPRINT} />)

        expect(
            screen.getByRole('heading', {level: 1, name: 'Impressum'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('heading', {level: 2, name: 'Diensteanbieter'}),
        ).toBeInTheDocument()
        expect(screen.getByText(new RegExp(`Stand:\\s*${IMPRINT.updated}`))).toBeInTheDocument()
    })
})
