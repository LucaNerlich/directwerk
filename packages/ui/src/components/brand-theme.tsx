'use client'

import type {CSSProperties, ReactNode} from 'react'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function foregroundFor(hex: string): string {
    const red = Number.parseInt(hex.slice(1, 3), 16)
    const green = Number.parseInt(hex.slice(3, 5), 16)
    const blue = Number.parseInt(hex.slice(5, 7), 16)
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
    return luminance > 0.56 ? '#171717' : '#ffffff'
}

export default function BrandTheme({
    primaryHex,
    children,
    className,
}: {
    primaryHex?: string | null
    children: ReactNode
    className?: string
}): React.JSX.Element {
    const primary = primaryHex !== null && primaryHex !== undefined &&
        HEX_COLOR.test(primaryHex)
        ? primaryHex
        : '#3f352b'
    const style = {
        '--primary': primary,
        '--ring': primary,
        '--sidebar-primary': primary,
        '--primary-foreground': foregroundFor(primary),
        '--sidebar-primary-foreground': foregroundFor(primary),
    } as CSSProperties

    return (
        <div className={className} style={style}>
            {children}
        </div>
    )
}
