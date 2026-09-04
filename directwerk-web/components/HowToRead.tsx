import HowToSubscribe from '@/components/HowToSubscribe'

/**
 * Backwards-compatible wrapper around {@link HowToSubscribe} (articles kind).
 * Kept so `/account` consumers keep working unchanged. `isAuthenticated` is
 * optional because the account page renders this in an authenticated context
 * without passing auth state; the articles block only shows the private feed
 * when the caller is authenticated AND provides one.
 */
export default function HowToRead({
    publicFeedUrl,
    privateFeedUrl,
    isAuthenticated = false,
}: {
    publicFeedUrl: string | null
    privateFeedUrl?: string | null
    isAuthenticated?: boolean
}): React.JSX.Element | null {
    return (
        <HowToSubscribe
            articles={{publicFeedUrl, privateFeedUrl}}
            isAuthenticated={isAuthenticated}
        />
    )
}
