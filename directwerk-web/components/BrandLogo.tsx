import Image from 'next/image'

import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'

/**
 * Tenant brand logo. Uses `next/image` (see `MEDIA_IMAGE_REMOTE_HOSTS` in
 * `next.config.ts`) with explicit dimensions; pass `priority` for the hero
 * logo, everywhere else it lazy-loads.
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
            className={className ?? 'h-10 w-auto'}
            height={48}
            priority={priority}
            sizes="(max-width: 640px) 120px, 160px"
            src={logoUrl}
            width={160}
        />
    )
}
