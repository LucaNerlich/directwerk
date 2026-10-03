import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it} from 'vitest'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import {TestLocale} from '@/lib/i18n/testWrapper'

afterEach(cleanup)

describe('FeedUrlDisplay', () => {
    it('renders safe https feed links', () => {
        render(<TestLocale><FeedUrlDisplay title="Feed" url="https://tenant.example/feed.xml" /></TestLocale>)

        expect(
            screen.getByRole('link', {name: 'Öffnen — Feed'}),
        ).toHaveAttribute('href', 'https://tenant.example/feed.xml')
    })

    it('never renders javascript: hrefs as clickable links', () => {
        const {container} = render(
            <TestLocale><FeedUrlDisplay title="Feed" url="javascript:alert(1)" /></TestLocale>,
        )

        expect(screen.queryByRole('link', {name: 'Öffnen — Feed'})).toBeNull()
        expect(container.innerHTML).not.toContain('href="javascript:')
    })
})
