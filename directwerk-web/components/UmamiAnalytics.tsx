'use client'

import {usePathname} from 'next/navigation'
import Script from 'next/script'

import type {SiteAnalytics} from '@directwerk/api/types'
import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'

interface UmamiAnalyticsProps {
    analytics: SiteAnalytics | null
}

// Pages whose URL carries a one-time credential. The tracker honours
// data-exclude-search, but Umami's session recorder does not, so the recorder must
// not be mounted here at all.
const TOKEN_PATH_SUFFIXES = ['/reset-password', '/accept-invite', '/verify-email', '/newsletter/confirm']

export default function UmamiAnalytics({
    analytics,
}: UmamiAnalyticsProps): React.JSX.Element {
    const pathname = usePathname()
    if (pathname !== null && TOKEN_PATH_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) {
        return <></>
    }
    if (analytics === null) {
        return <></>
    }

    if (!isAllowedFeedUrl(analytics.umamiScriptUrl)) {
        return <></>
    }

    const sampleRate = process.env.NEXT_PUBLIC_UMAMI_SAMPLE_RATE ?? '0.25'
    const maskLevel = process.env.NEXT_PUBLIC_UMAMI_MASK_LEVEL ?? 'moderate'
    const maxDuration = process.env.NEXT_PUBLIC_UMAMI_MAX_DURATION ?? '300000'
    const recorderUrl = `${analytics.umamiHostUrl}/recorder.js`
    if (!isAllowedFeedUrl(recorderUrl)) {
        return <></>
    }

    return (
        <>
            <Script
                async
                data-do-not-track="true"
                data-exclude-search="true"
                data-website-id={analytics.umamiWebsiteId}
                src={analytics.umamiScriptUrl}
                strategy="afterInteractive"
            />
            {/* Replay is optional sampled work — defer past hydration (#858). */}
            <Script
                async
                data-do-not-track="true"
                data-exclude-search="true"
                data-mask-level={maskLevel}
                data-max-duration={maxDuration}
                data-sample-rate={sampleRate}
                data-website-id={analytics.umamiWebsiteId}
                src={recorderUrl}
                strategy="lazyOnload"
            />
        </>
    )
}
