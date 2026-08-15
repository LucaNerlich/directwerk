'use client'

import type {CSSProperties, ReactNode} from 'react'

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function linearizeChannel(channel: number): number {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
    const red = Number.parseInt(hex.slice(1, 3), 16)
    const green = Number.parseInt(hex.slice(3, 5), 16)
    const blue = Number.parseInt(hex.slice(5, 7), 16)
    return (
        0.2126 * linearizeChannel(red) +
        0.7152 * linearizeChannel(green) +
        0.0722 * linearizeChannel(blue)
    )
}

function foregroundFor(hex: string): string {
    // WCAG relative luminance; #171717 needs L >= ~0.214 for AA contrast.
    return relativeLuminance(hex) > 0.214 ? '#171717' : '#ffffff'
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
