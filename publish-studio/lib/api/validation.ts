const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254
const MAX_OAUTH_TOKEN_LENGTH = 8192
const MAX_JSON_BYTES = 16_384

export async function readBoundedBody(
    body: ReadableStream<Uint8Array> | null,
): Promise<string | null> {
    if (!body) {
        return null
    }

    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    try {
        while (true) {
            const {done, value} = await reader.read()
            if (done) {
                break
            }

            totalBytes += value.byteLength
            if (totalBytes > MAX_JSON_BYTES) {
                reader.cancel()
                return null
            }
            chunks.push(value)
        }

        const bodyBytes = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
            bodyBytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return new TextDecoder().decode(bodyBytes)
    } catch {
        return null
    }
}

export interface LoginInput {
    email: string
    password: string
}

export interface RefreshTokenInput {
    refresh_token: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseJsonText(value: string | null): unknown | null {
    if (value === null) {
        return null
    }

    try {
        return JSON.parse(value) as unknown
    } catch {
        return null
    }
}

function parsePassword(value: unknown): string | null {
    if (
        typeof value !== 'string' ||
        value.length < MIN_PASSWORD_LENGTH ||
        value.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    return value
}

export function parseLoginInput(value: unknown): LoginInput | null {
    if (!isRecord(value)) {
        return null
    }

    const email = value.email
    const password = parsePassword(value.password)
    if (
        typeof email !== 'string' ||
        email.length === 0 ||
        email.length > MAX_EMAIL_LENGTH ||
        !EMAIL_PATTERN.test(email) ||
        password === null
    ) {
        return null
    }

    return {email, password}
}

export function parseRefreshTokenInput(value: unknown): RefreshTokenInput | null {
    if (!isRecord(value)) {
        return null
    }

    const refreshToken = value.refresh_token
    if (
        typeof refreshToken !== 'string' ||
        refreshToken.length === 0 ||
        refreshToken.length > MAX_OAUTH_TOKEN_LENGTH ||
        /\s/.test(refreshToken)
    ) {
        return null
    }

    return {refresh_token: refreshToken}
}
