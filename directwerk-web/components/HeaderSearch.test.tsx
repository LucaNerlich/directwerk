import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import {TestLocale} from '@/lib/i18n/testWrapper'
import {clearSearchDocumentCache} from '@/lib/search/headerSearch'

import {HeaderSearchButton, HeaderSearchDialog, resetHeaderSearchState} from './HeaderSearch'

const {push} = vi.hoisted(() => ({push: vi.fn()}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({push}),
    usePathname: () => '/de',
}))

const documents = [
    {
        kind: 'article',
        title: 'Geheimes Essay',
        slug: 'geheim',
        excerpt: 'Teaser',
        plainText: '',
        hrefPath: '/articles/geheim',
        access: 'PAID',
    },
    {
        kind: 'article',
        title: 'Offener Text',
        slug: 'offen',
        excerpt: 'Offen',
        plainText: 'Offener Text mit mehr Worten',
        hrefPath: '/articles/offen',
        access: 'FREE',
    },
]

afterEach(() => {
    resetHeaderSearchState()
    clearSearchDocumentCache()
    push.mockReset()
    vi.unstubAllGlobals()
    cleanup()
})

function renderSearch(): void {
    render(
        <TestLocale>
            <HeaderSearchButton />
            <HeaderSearchDialog />
        </TestLocale>,
    )
}

describe('HeaderSearch', () => {
    it('opens from the button and from slash, then searches the feed', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                new Response(JSON.stringify({data: documents}), {
                    status: 200,
                    headers: {'content-type': 'application/json'},
                }),
            ),
        )
        renderSearch()

        fireEvent.keyDown(document, {key: '/'})
        expect(await screen.findByRole('dialog')).toBeInTheDocument()
        expect(screen.getByText('Suchbegriff eingeben')).toBeInTheDocument()
        expect(screen.queryByRole('option')).not.toBeInTheDocument()

        const field = screen.getByPlaceholderText('Titel, Themen, Seiten')
        fireEvent.change(field, {target: {value: 'geheim'}})
        expect(await screen.findByRole('option', {name: /Geheimes Essay/})).toBeInTheDocument()
        expect(screen.getByText('Abo nötig')).toBeInTheDocument()

        fireEvent.change(field, {target: {value: 'offener'}})
        const openHit = await screen.findByRole('option', {name: 'Offener Text'})
        expect(openHit).toBeInTheDocument()
        expect(screen.queryByText('Abo nötig')).not.toBeInTheDocument()

        fireEvent.keyDown(field, {key: 'Enter'})
        expect(push).toHaveBeenCalledWith('/de/articles/offen')
    })

    it('shows a status row when nothing matches', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                new Response(JSON.stringify({data: []}), {
                    status: 200,
                    headers: {'content-type': 'application/json'},
                }),
            ),
        )
        renderSearch()
        fireEvent.click(screen.getAllByRole('button', {name: 'Suchen'})[0]!)
        const field = await screen.findByPlaceholderText('Titel, Themen, Seiten')
        fireEvent.change(field, {target: {value: 'zzzz-not-a-page'}})
        await waitFor(() => {
            expect(screen.getByRole('status')).toHaveTextContent('Keine Treffer')
        })
    })
})
