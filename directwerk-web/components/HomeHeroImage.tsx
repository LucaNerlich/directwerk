import Image from 'next/image'

import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'

/**
 * Full-bleed-capable hero artwork that never stretches: the frame keeps a fixed
 * aspect ratio and the image uses `object-cover` with centered positioning.
 */
export default function HomeHeroImage({
    src,
    alt,
    priority = false,
}: {
    src: string
    alt: string
    priority?: boolean
}): React.JSX.Element | null {
    if (!isAllowedFeedUrl(src)) {
        return null
    }

    return (
        <div className="dw-glass relative aspect-[4/5] w-full overflow-hidden rounded-3xl sm:aspect-[5/6]">
            <Image
                alt={alt}
                className="dw-hero-image"
                fill
                priority={priority}
                sizes="(max-width: 768px) 92vw, 40vw"
                src={src}
            />
        </div>
    )
}
