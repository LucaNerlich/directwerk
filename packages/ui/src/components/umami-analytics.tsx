import Script from 'next/script'

interface UmamiAnalyticsProps {
    /**
     * Session-replay masking strictness forwarded as `data-mask-level`.
     * Defaults to `'strict'` (administration/creator apps); the marketing
     * site passes `'moderate'`.
     */
    maskLevel?: string
}

/**
 * Shared Umami analytics + session-replay snippet, configured through the
 * `NEXT_PUBLIC_UMAMI_WEBSITE_ID` / `NEXT_PUBLIC_UMAMI_URL` environment
 * variables. Renders nothing unless both are set. Sampling, masking, and
 * retention knobs stay env-driven (`NEXT_PUBLIC_UMAMI_SAMPLE_RATE`,
 * `NEXT_PUBLIC_UMAMI_MAX_DURATION`).
 */
export default function UmamiAnalytics({
    maskLevel = 'strict',
}: UmamiAnalyticsProps): React.JSX.Element {
    const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
    const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL
    const sampleRate = process.env.NEXT_PUBLIC_UMAMI_SAMPLE_RATE ?? '0.25'
    const maxDuration = process.env.NEXT_PUBLIC_UMAMI_MAX_DURATION ?? '300000'

    if (!websiteId || !umamiUrl) {
        return <></>
    }

    return (
        <>
            <Script
                async
                data-do-not-track="true"
                data-website-id={websiteId}
                src={`${umamiUrl}/script.js`}
                strategy="afterInteractive"
            />
            <Script
                async
                data-do-not-track="true"
                data-mask-level={maskLevel}
                data-max-duration={maxDuration}
                data-sample-rate={sampleRate}
                data-website-id={websiteId}
                src={`${umamiUrl}/recorder.js`}
                strategy="afterInteractive"
            />
        </>
    )
}
