import {fireEvent, render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

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

    it('closes the mobile sheet when a nav link is clicked', () => {
        render(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Beiträge</a>}
            >
                <h1>Inhalt</h1>
            </SiteShell>,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Menü öffnen'}))
        expect(screen.getByRole('dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('link', {name: 'Beiträge'}))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes the mobile sheet when navigationCloseSignal changes', () => {
        const {rerender} = render(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Beiträge</a>}
                navigationCloseSignal="/de"
            >
                <h1>Inhalt</h1>
            </SiteShell>,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Menü öffnen'}))
        expect(screen.getByRole('dialog')).toBeInTheDocument()

        rerender(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Beiträge</a>}
                navigationCloseSignal="/de/articles"
            >
                <h1>Inhalt</h1>
            </SiteShell>,
        )
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('renders mobileActions in the sheet instead of desktop actions', () => {
        render(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Beiträge</a>}
                actions={<button type="button">Desktop only</button>}
                mobileActions={<button type="button">Mobile row</button>}
            >
                <h1>Inhalt</h1>
            </SiteShell>,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Menü öffnen'}))
        expect(screen.getByRole('button', {name: 'Mobile row'})).toBeInTheDocument()
        expect(screen.queryByRole('button', {name: 'Desktop only'})).not.toBeInTheDocument()
    })

    it('notifies the host when controlled open state changes', () => {
        const onOpenChange = vi.fn()
        render(
            <SiteShell
                brand={<a href="/">Directwerk</a>}
                navigation={<a href="/articles">Beiträge</a>}
                navigationOpen={false}
                onNavigationOpenChange={onOpenChange}
            >
                <h1>Inhalt</h1>
            </SiteShell>,
        )

        fireEvent.click(screen.getByRole('button', {name: 'Menü öffnen'}))
        expect(onOpenChange.mock.calls[0]?.[0]).toBe(true)
    })
})
