import {afterEach, describe, expect, it} from 'vitest'

import {
    dismissFeedOnboarding,
    FEED_ONBOARDING_DISMISSED_KEY,
    isFeedOnboardingDismissed,
} from '@/lib/feeds/feedOnboardingStorage'

afterEach(() => {
    window.localStorage.clear()
})

describe('feedOnboardingStorage', () => {
    it('starts undismissed', () => {
        expect(isFeedOnboardingDismissed()).toBe(false)
    })

    it('persists dismiss in localStorage', () => {
        dismissFeedOnboarding()
        expect(window.localStorage.getItem(FEED_ONBOARDING_DISMISSED_KEY)).toBe('1')
        expect(isFeedOnboardingDismissed()).toBe(true)
    })
})
