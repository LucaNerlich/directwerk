import {safeImageSrc} from '@/lib/url/safeUrl'

/**
 * Prefer branding favicon, then logo. Same priority as login workspace
 * avatars and the studio sidebar mark — HTTPS-only via `safeImageSrc`.
 */
export function tenantBrandImageSrc(
    faviconUrl: string | null | undefined,
    logoUrl: string | null | undefined,
): string | null {
    return safeImageSrc(faviconUrl) ?? safeImageSrc(logoUrl)
}
