import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import FeedSetupBanner from '@/components/FeedSetupBanner'
import {FEED_ONBOARDING_DISMISSED_KEY} from '@/lib/feeds/feedOnboardingStorage'
import {TestLocale} from '@/lib/i18n/testWrapper'

const searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParams,
}))

afterEach(() => {
    cleanup()
    window.localStorage.clear()
    for (const key of [...searchParams.keys()]) {
        searchParams.delete(key)
    }
})

describe('FeedSetupBanner', () => {
    it('hides without setup=1', () => {
        const {container} = render(
            <TestLocale>
                <FeedSetupBanner />
            </TestLocale>,
        )
        expect(container).toBeEmptyDOMElement()
    })

    it('shows and dismisses with localStorage', () => {
        searchParams.set('setup', '1')
        render(
            <TestLocale>
                <FeedSetupBanner />
            </TestLocale>,
        )

        expect(
            screen.getByText('Setup abschließen: Feed in der Podcast-App hinzufügen'),
        ).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', {name: 'Verstanden'}))
        expect(
            screen.queryByText('Setup abschließen: Feed in der Podcast-App hinzufügen'),
        ).not.toBeInTheDocument()
        expect(window.localStorage.getItem(FEED_ONBOARDING_DISMISSED_KEY)).toBe('1')
    })
})
