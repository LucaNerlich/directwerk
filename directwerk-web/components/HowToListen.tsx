import HowToSubscribe from '@/components/HowToSubscribe'

/**
 * Backwards-compatible wrapper around {@link HowToSubscribe} (podcast kind).
 * Kept so `/feeds` and `/account` consumers keep working unchanged.
 */
export default function HowToListen({
    publicFeedUrl,
    privateFeedUrl,
    isAuthenticated,
}: {
    publicFeedUrl: string | null
    privateFeedUrl?: string | null
    isAuthenticated: boolean
}): React.JSX.Element | null {
    return (
        <HowToSubscribe
            isAuthenticated={isAuthenticated}
            podcast={{publicFeedUrl, privateFeedUrl}}
        />
    )
}
