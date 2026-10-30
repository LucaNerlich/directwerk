export interface DirectwerkClientConfig {
    baseUrl: string
    apiKey: string
    tenantHost: string
}

export class DirectwerkApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly body: unknown,
    ) {
        super(message)
        this.name = 'DirectwerkApiError'
    }
}

export class DirectwerkClient {
    constructor(private readonly config: DirectwerkClientConfig) {}

    async request<T = unknown>(
        method: string,
        path: string,
        body?: unknown,
        query?: Record<string, string | number | boolean | undefined>,
    ): Promise<T> {
        const url = new URL(path.replace(/^\//, ''), ensureTrailingSlash(this.config.baseUrl))
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, String(value))
                }
            }
        }

        const headers: Record<string, string> = {
            Accept: 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
            // BFF-style tenant routing (Node fetch forbids overriding Host).
            'X-Tenant-Host': this.config.tenantHost,
        }
        const init: RequestInit = {method, headers}
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json'
            init.body = JSON.stringify(body)
        }

        const response = await fetch(url, init)
        const text = await response.text()
        let parsed: unknown = null
        if (text.length > 0) {
            try {
                parsed = JSON.parse(text) as unknown
            } catch {
                parsed = text
            }
        }
        if (!response.ok) {
            throw new DirectwerkApiError(
                `Directwerk API ${method} ${path} failed (${response.status})`,
                response.status,
                parsed,
            )
        }
        return parsed as T
    }
}

export function loadConfigFromEnv(
    env: NodeJS.ProcessEnv = process.env,
): DirectwerkClientConfig {
    const baseUrl = required(env.DIRECTWERK_API_BASE_URL, 'DIRECTWERK_API_BASE_URL')
    const apiKey = required(env.DIRECTWERK_API_KEY, 'DIRECTWERK_API_KEY')
    const tenantHost = required(env.DIRECTWERK_TENANT_HOST, 'DIRECTWERK_TENANT_HOST')
    if (!apiKey.startsWith('dwk_')) {
        throw new Error('DIRECTWERK_API_KEY must be a tenant API key (dwk_…)')
    }
    return {baseUrl: baseUrl.replace(/\/$/, ''), apiKey, tenantHost}
}

function required(value: string | undefined, name: string): string {
    if (!value || value.trim() === '') {
        throw new Error(`Missing required env ${name}`)
    }
    return value.trim()
}

function ensureTrailingSlash(baseUrl: string): string {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}
