interface MediaImageRemotePattern {
    protocol: 'https'
    hostname: string
    port: ''
    pathname: '/**'
}

const DEFAULT_MEDIA_IMAGE_HOSTS = [
    'directwerk-dev.b-cdn.net',
    'cdn.stage.directwerk.de',
    'cdn.directwerk.de',
]

const EXACT_HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function parseMediaImageRemoteHosts(raw: string | undefined): string[] {
    const fromEnv = (raw ?? '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter((host) => EXACT_HOSTNAME_PATTERN.test(host))

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
                port: '',
                pathname: '/**',
            },
        ]
    })
}
