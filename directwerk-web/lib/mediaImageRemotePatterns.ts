interface MediaImageRemotePattern {
    protocol: 'https'
    hostname: string
    port: string
    pathname: '/**'
}

const DEFAULT_MEDIA_IMAGE_HOSTS = [
    'directwerk-dev.b-cdn.net',
    'directwerk-dev2.b-cdn.net',
    'directwerk-dev.nbg1.your-objectstorage.com',
    'cdn.stage.directwerk.org',
    'cdn.directwerk.org',
]

const EXACT_HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

interface MediaImageRemoteHost {
    hostname: string
    port: string
}

function parseMediaImageRemoteHost(value: string): MediaImageRemoteHost | null {
    const separator = value.lastIndexOf(':')
    const hostname = separator === -1 ? value : value.slice(0, separator)
    const rawPort = separator === -1 ? '' : value.slice(separator + 1)
    const port = Number(rawPort)

    if (
        !EXACT_HOSTNAME_PATTERN.test(hostname) ||
        (separator !== -1 &&
            (!/^\d+$/.test(rawPort) || port < 1 || port > 65_535))
    ) {
        return null
    }

    return {
        hostname,
        port: separator === -1 || port === 443 ? '' : String(port),
    }
}

export function parseMediaImageRemoteHosts(
    raw: string | undefined
): MediaImageRemoteHost[] {
    const fromEnv = (raw ?? '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .map(parseMediaImageRemoteHost)
        .filter((host): host is MediaImageRemoteHost => host !== null)

    return fromEnv.length > 0
        ? fromEnv
        : DEFAULT_MEDIA_IMAGE_HOSTS.map((hostname) => ({hostname, port: ''}))
}

export function buildMediaImageRemotePatterns(
    rawHosts: string | undefined
): MediaImageRemotePattern[] {
    const seen = new Set<string>()

    return parseMediaImageRemoteHosts(rawHosts).flatMap(({hostname, port}) => {
        const authority = `${hostname}:${port}`
        if (seen.has(authority)) {
            return []
        }
        seen.add(authority)

        return [
            {
                protocol: 'https',
                hostname,
                port,
                pathname: '/**',
            },
        ]
    })
}
