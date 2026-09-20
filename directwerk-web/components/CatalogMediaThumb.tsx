import Image from 'next/image'

import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'

/**
 * Square catalog / detail artwork. Only renders https (or loopback http) URLs.
 */
export default function CatalogMediaThumb({
    src,
    alt,
    size = 'sm',
    priority = false,
}: {
    src: string | null | undefined
    alt: string
    size?: 'sm' | 'lg'
    priority?: boolean
}): React.JSX.Element | null {
    if (src == null || !isAllowedFeedUrl(src)) {
        return null
    }

    const pixels = size === 'lg' ? 320 : 64
    return (
        <Image
            alt={alt}
            className={
                size === 'lg'
                    ? 'aspect-square w-full max-w-xs rounded-xl object-cover'
                    : 'size-14 shrink-0 rounded-lg object-cover'
            }
            height={pixels}
            preload={priority}
            sizes={size === 'lg' ? '(max-width: 640px) 80vw, 320px' : '56px'}
            src={src}
            width={pixels}
        />
    )
}
