import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import Home from '@/app/page'

describe('Home', () => {
    it('introduces the platform and offers a contact path', () => {
        render(<Home />)

        expect(
            screen.getByRole('heading', {name: /Deine Inhalte/}),
        ).toBeInTheDocument()
        expect(screen.getByRole('link', {name: 'Kontakt'})).toHaveAttribute(
            'href',
            'mailto:hello@directwerk.de',
        )
    })
})
