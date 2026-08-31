import Script from 'next/script'

export default function UmamiAnalytics(): React.JSX.Element {
    const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
    const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL
    const sampleRate = process.env.NEXT_PUBLIC_UMAMI_SAMPLE_RATE ?? '0.25'
    const maskLevel = process.env.NEXT_PUBLIC_UMAMI_MASK_LEVEL ?? 'strict'
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
