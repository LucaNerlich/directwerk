import {isAllowedFeedUrl} from '@/lib/feeds'

/**
 * Renders a tenant logo only when the URL is https or loopback http.
 */
export default function BrandLogo({
    logoUrl,
    name,
    className,
}: {
    logoUrl: string | null
    name: string
    className?: string
}): React.JSX.Element | null {
    if (logoUrl === null || !isAllowedFeedUrl(logoUrl)) {
        return null
    }

    return (
        <img
            alt={name}
            className={className ?? 'h-10 w-auto'}
            src={logoUrl}
        />
    )
}
