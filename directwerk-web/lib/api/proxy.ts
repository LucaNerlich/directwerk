const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_.-]+$/
const MAX_TOKEN_LENGTH = 8192

export function buildProxyPath(segments: string[]): string | null {
    if (
        segments.length === 0 ||
        segments.some(
            (segment) =>
                segment.length === 0 ||
                segment === '.' ||
                segment === '..' ||
                !SAFE_PATH_SEGMENT.test(segment),
        )
    ) {
        return null
    }

    return `/api/v1/${segments.join('/')}`
}

export function hasUnsupportedProxyQuery(requestUrl: string): boolean {
    return new URL(requestUrl).search !== ''
}

export function readBearerToken(value: string | null): string | null {
    if (value === null || !value.startsWith('Bearer ')) {
        return null
    }

    const token = value.slice('Bearer '.length)
    if (
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH ||
        /\s/.test(token)
    ) {
        return null
    }

    return token
}
