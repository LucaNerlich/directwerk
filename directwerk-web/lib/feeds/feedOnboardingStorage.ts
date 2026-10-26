/** localStorage key for dismissing the private-feed setup banner on `/feeds`. */
export const FEED_ONBOARDING_DISMISSED_KEY = 'dw.feedOnboardingDismissed'

export function isFeedOnboardingDismissed(): boolean {
    if (typeof window === 'undefined') {
        return false
    }
    try {
        return window.localStorage.getItem(FEED_ONBOARDING_DISMISSED_KEY) === '1'
    } catch {
        return false
    }
}

export function dismissFeedOnboarding(): void {
    if (typeof window === 'undefined') {
        return
    }
    try {
        window.localStorage.setItem(FEED_ONBOARDING_DISMISSED_KEY, '1')
    } catch {
        // Ignore quota / private-mode failures — banner can reappear.
    }
}
