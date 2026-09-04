import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'

afterEach(cleanup)

describe('FeedUrlDisplay', () => {
    it('renders safe https feed links', () => {
        render(<FeedUrlDisplay title="Feed" url="https://tenant.example/feed.xml" />)

        expect(
            screen.getByRole('link', {name: 'Öffnen — Feed'}),
        ).toHaveAttribute('href', 'https://tenant.example/feed.xml')
    })

    it('never renders javascript: hrefs as clickable links', () => {
        const {container} = render(
            <FeedUrlDisplay title="Feed" url="javascript:alert(1)" />,
        )

        expect(screen.queryByRole('link', {name: 'Öffnen — Feed'})).toBeNull()
        expect(container.innerHTML).not.toContain('href="javascript:')
    })
})
