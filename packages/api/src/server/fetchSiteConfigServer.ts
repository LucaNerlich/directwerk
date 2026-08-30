import 'server-only'

export interface SiteConfigFetchRequest {
    path: string
    tenantHost: string
    method: 'GET'
}

export interface SiteConfigServerFetcher {
    (request: SiteConfigFetchRequest): Promise<Response>
}

export async function fetchSiteConfigServerOptional<T>({
    fetch,
    host,
    parseEnvelope,
    errorLabel = 'site-config',
}: {
    fetch: SiteConfigServerFetcher
    host: string
    parseEnvelope: (value: unknown) => {data: T} | null
    errorLabel?: string
}): Promise<T | null> {
    const response = await fetch({
        path: '/api/v1/public/site-config',
        tenantHost: host,
        method: 'GET',
    })

    if (response.status === 404) {
        return null
    }

    if (!response.ok) {
        throw new Error(
            `${errorLabel} request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const value: unknown = await response.json()
    const parsed = parseEnvelope(value)
    if (parsed === null) {
        throw new Error(`${errorLabel} response invalid for host ${host}`)
    }

    return parsed.data
}

export async function fetchSiteConfigServer<T>({
    fetch,
    host,
    parseEnvelope,
    errorLabel = 'site-config',
}: {
    fetch: SiteConfigServerFetcher
    host: string
    parseEnvelope: (value: unknown) => {data: T} | null
    errorLabel?: string
}): Promise<T> {
    const response = await fetch({
        path: '/api/v1/public/site-config',
        tenantHost: host,
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(
            `${errorLabel} request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const value: unknown = await response.json()
    const parsed = parseEnvelope(value)
    if (parsed === null) {
        throw new Error(`${errorLabel} response invalid for host ${host}`)
    }

    return parsed.data
}
