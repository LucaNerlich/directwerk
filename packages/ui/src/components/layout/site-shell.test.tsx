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

    it('uses the labels the host app passes for its locale', () => {
        render(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Articles</a>}
                navigationLabel="Navigation"
                navigationTriggerLabel="Open menu"
                skipLinkLabel="Skip to content"
            >
                <h1>Content</h1>
            </SiteShell>,
        )

        expect(screen.getByRole('link', {name: 'Skip to content'})).toHaveAttribute(
            'href',
            '#main-content',
        )
        expect(screen.getByRole('button', {name: 'Open menu'})).toBeInTheDocument()
        expect(screen.queryByText('Zum Inhalt springen')).not.toBeInTheDocument()
    })
})
