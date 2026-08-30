import Script from 'next/script'

import type {SiteAnalytics} from '@directwerk/api/types'

interface UmamiAnalyticsProps {
    analytics: SiteAnalytics | null
}

export default function UmamiAnalytics({
    analytics,
}: UmamiAnalyticsProps): React.JSX.Element {
    if (analytics === null) {
        return <></>
    }

    const sampleRate = process.env.NEXT_PUBLIC_UMAMI_SAMPLE_RATE ?? '0.25'
    const maskLevel = process.env.NEXT_PUBLIC_UMAMI_MASK_LEVEL ?? 'moderate'
    const maxDuration = process.env.NEXT_PUBLIC_UMAMI_MAX_DURATION ?? '300000'
    const recorderUrl = `${analytics.umamiHostUrl}/recorder.js`

    return (
        <>
            <Script
                async
                data-website-id={analytics.umamiWebsiteId}
                src={analytics.umamiScriptUrl}
                strategy="afterInteractive"
            />
            <Script
                async
                data-mask-level={maskLevel}
                data-max-duration={maxDuration}
                data-sample-rate={sampleRate}
                data-website-id={analytics.umamiWebsiteId}
                src={recorderUrl}
                strategy="afterInteractive"
            />
        </>
    )
}
