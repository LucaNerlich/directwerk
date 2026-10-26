import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import BrandLogo from './BrandLogo'

afterEach(cleanup)

describe('BrandLogo', () => {
    it('loads external branding logos without the next/image optimizer', () => {
        // Regression for #853: tenant logoUrl may be any https host (e.g. Nextcloud
        // publicpreview). Optimizer remotePatterns only allow platform CDN hosts,
        // so optimized src would 400 with "url parameter is not allowed".
        const logoUrl =
            'https://share.lucanerlich.com/apps/files_sharing/publicpreview/rgAswcgtPYbfMcT'

        render(<BrandLogo logoUrl={logoUrl} name="Luca Nerlich" />)

        const img = screen.getByRole('img', {name: 'Luca Nerlich'})
        expect(img).toHaveAttribute('src', logoUrl)
        expect(img.getAttribute('src')).not.toContain('/_next/image')
    })

    it('does not render disallowed logo URLs', () => {
        const {container} = render(
            <BrandLogo logoUrl="javascript:alert(1)" name="Nope" />,
        )

        expect(screen.queryByRole('img')).toBeNull()
        expect(container.innerHTML).toBe('')
    })
})
