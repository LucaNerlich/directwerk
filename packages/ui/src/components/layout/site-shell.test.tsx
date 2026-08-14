import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import SiteShell from './site-shell'

describe('SiteShell', () => {
    it('provides accessible navigation and a mobile menu trigger', () => {
        render(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Beiträge</a>}
            >
                <h1>Inhalt</h1>
            </SiteShell>,
        )

        expect(screen.getByRole('link', {name: 'Zum Inhalt springen'})).toHaveAttribute(
            'href',
            '#main-content',
        )
        expect(screen.getByRole('button', {name: 'Menü öffnen'})).toBeInTheDocument()
        expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
    })
})
