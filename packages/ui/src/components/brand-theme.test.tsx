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

    it('applies the tenant secondary color with a readable foreground', () => {
        render(
            <BrandTheme primaryHex="#3f352b" secondaryHex="#e94560">
                <span>Secondary content</span>
            </BrandTheme>,
        )

        expect(screen.getByText('Secondary content').parentElement).toHaveStyle({
            '--secondary': '#e94560',
            '--secondary-foreground': '#171717',
        })
    })

    it('leaves secondary surfaces on the theme default without a valid color', () => {
        const {container} = render(
            <BrandTheme primaryHex="#3f352b" secondaryHex="not-a-color">
                <span>Default secondary</span>
            </BrandTheme>,
        )

        expect(container.firstElementChild?.getAttribute('style')).not.toContain(
            '--secondary',
        )
    })
})
