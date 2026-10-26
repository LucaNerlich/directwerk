import Image from 'next/image'

import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'
import {cn} from '@directwerk/ui/lib/utils'

/**
 * Tenant brand logo. Branding `logoUrl` is an arbitrary https URL (platform CDN
 * or external host). `next/image` optimization only allows
 * `MEDIA_IMAGE_REMOTE_HOSTS`, so this always uses `unoptimized` and loads the
 * URL directly — otherwise external logos 400 via `/_next/image`.
 *
 * Intrinsic aspect is preserved via `object-contain` and auto width/height —
 * never stretched to a fixed box. Pass `priority` for the hero logo;
 * everywhere else it lazy-loads.
 *
 * Only renders when the URL is https or loopback http.
 */
export default function BrandLogo({
    logoUrl,
    name,
    className,
    priority = false,
}: {
    logoUrl: string | null
    name: string
    className?: string
    priority?: boolean
}): React.JSX.Element | null {
    if (logoUrl === null || !isAllowedFeedUrl(logoUrl)) {
        return null
    }

    return (
        <Image
            alt={name}
            className={cn('h-auto w-auto max-h-10 object-contain', className)}
            height={160}
            priority={priority}
            sizes="(max-width: 640px) 140px, 200px"
            src={logoUrl}
            style={{width: 'auto', height: 'auto'}}
            unoptimized
            width={320}
        />
    )
}
