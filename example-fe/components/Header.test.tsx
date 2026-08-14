import {fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import Header from './Header'

vi.mock('next/navigation', () => ({
    usePathname: () => '/feeds',
    useRouter: () => ({replace: vi.fn()}),
}))

afterEach(() => {
    window.localStorage.clear()
})

describe('Header', () => {
    it('renders the shared accessible shell with active navigation', () => {
        render(
            <Header>
                <p>Subscriber content</p>
            </Header>,
        )

        expect(screen.getByText('Zum Inhalt springen')).toHaveAttribute(
            'href',
            '#main-content',
        )
        expect(screen.getAllByRole('link', {name: 'Feeds'})[0]).toHaveAttribute(
            'aria-current',
            'page',
        )
        expect(screen.getByRole('main')).toHaveTextContent('Subscriber content')

        fireEvent.click(screen.getByRole('button', {name: 'Menü öffnen'}))
        expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
})
