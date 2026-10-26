import Script from 'next/script'

/**
 * Issue #405: accepts https, or http on loopback for local development. Kept local so
 * `packages/ui` stays presentation-only (no dependency on the API package).
 */
function isTrustedScriptOrigin(url: string): boolean {
    try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:') {
            return true
        }
        return (
            parsed.protocol === 'http:' &&
            (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
        )
    } catch {
        return false
    }
}

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
 * `NEXT_PUBLIC_UMAMI_MASK_LEVEL`, `NEXT_PUBLIC_UMAMI_MAX_DURATION`).
 */
export default function UmamiAnalytics({
    maskLevel = process.env.NEXT_PUBLIC_UMAMI_MASK_LEVEL ?? 'strict',
}: UmamiAnalyticsProps): React.JSX.Element {
    const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
    const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL
    const sampleRate = process.env.NEXT_PUBLIC_UMAMI_SAMPLE_RATE ?? '0.25'
    const maxDuration = process.env.NEXT_PUBLIC_UMAMI_MAX_DURATION ?? '300000'

    if (!websiteId || !umamiUrl || !isTrustedScriptOrigin(umamiUrl)) {
        // Issue #405: the shared component interpolated NEXT_PUBLIC_UMAMI_URL with no scheme/host
        // check (the tenant-config variant validates first), so an unvalidated value became a
        // stored-script sink. Render nothing rather than emit an untrusted script src.
        return <></>
    }

    const scriptBase = umamiUrl.replace(/\/+$/, '')

    return (
        <>
            <Script
                async
                data-do-not-track="true"
                data-website-id={websiteId}
                src={`${scriptBase}/script.js`}
                strategy="afterInteractive"
            />
            <Script
                async
                data-do-not-track="true"
                data-mask-level={maskLevel}
                data-max-duration={maxDuration}
                data-sample-rate={sampleRate}
                data-website-id={websiteId}
                src={`${scriptBase}/recorder.js`}
                strategy="lazyOnload"
            />
        </>
    )
}
