import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import BrandTheme from './brand-theme'

describe('BrandTheme', () => {
    it('applies a valid tenant color with a readable foreground', () => {
        render(
            <BrandTheme primaryHex="#f0d34f">
                <span>Brand content</span>
            </BrandTheme>,
        )

        const container = screen.getByText('Brand content').parentElement
        expect(container).toHaveStyle({
            '--primary': '#f0d34f',
            '--primary-foreground': '#171717',
        })
    })

    it('falls back when the external color is invalid', () => {
        render(
            <BrandTheme primaryHex="not-a-color">
                <span>Fallback content</span>
            </BrandTheme>,
        )

        expect(screen.getByText('Fallback content').parentElement).toHaveStyle({
            '--primary': '#3f352b',
        })
    })
})
