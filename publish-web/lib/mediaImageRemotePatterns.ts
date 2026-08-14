interface MediaImageRemotePattern {
    protocol: 'https'
    hostname: string
}

const DEFAULT_MEDIA_IMAGE_HOSTS = [
    '*.b-cdn.net',
    '*.storage.bunnycdn.com',
]

export function parseMediaImageRemoteHosts(raw: string | undefined): string[] {
    const fromEnv = (raw ?? '')
        .split(',')
        .map((host) => host.trim())
        .filter((host) => host.length > 0 && host.length <= 253)

    return fromEnv.length > 0 ? fromEnv : DEFAULT_MEDIA_IMAGE_HOSTS
}

export function buildMediaImageRemotePatterns(
    rawHosts: string | undefined
): MediaImageRemotePattern[] {
    const seen = new Set<string>()

    return parseMediaImageRemoteHosts(rawHosts).flatMap((hostname) => {
        if (seen.has(hostname)) {
            return []
        }
        seen.add(hostname)

        return [
            {
                protocol: 'https',
                hostname,
            },
        ]
    })
}
