const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 255
const MAX_TOKEN_LENGTH = 512
const MAX_OAUTH_TOKEN_LENGTH = 8192
const MAX_JSON_BYTES = 16_384

export async function readBoundedBody(body: ReadableStream<Uint8Array> | null): Promise<string | null> {
    if (!body) {
        return null
    }

    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    try {
        while (true) {
            const {done, value} = await reader.read()
            if (done) break

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

export interface RegisterInput extends LoginInput {
    name?: string
}

export interface AcceptInviteInput {
    token: string
    password: string
    name?: string
}

export interface ForgotPasswordInput {
    email: string
}

export interface ResetPasswordInput {
    token: string
    newPassword: string
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

function parseCredentials(value: unknown): LoginInput | null {
    if (!isRecord(value)) {
        return null
    }

    if (typeof value.email !== 'string' || typeof value.password !== 'string') {
        return null
    }

    const email = value.email.trim().toLowerCase()
    if (
        email.length === 0 ||
        email.length > MAX_EMAIL_LENGTH ||
        !EMAIL_PATTERN.test(email) ||
        value.password.length < MIN_PASSWORD_LENGTH ||
        value.password.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    return {email, password: value.password}
}

export function parseLoginInput(value: unknown): LoginInput | null {
    return parseCredentials(value)
}

export function parseRegisterInput(value: unknown): RegisterInput | null {
    const credentials = parseCredentials(value)
    if (credentials === null || !isRecord(value)) {
        return null
    }

    if (value.name === undefined) {
        return credentials
    }

    if (typeof value.name !== 'string') {
        return null
    }

    const name = value.name.trim()
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        return null
    }

    return {...credentials, name}
}

function parseOptionalName(value: unknown): string | undefined | null {
    if (!isRecord(value) || value.name === undefined) {
        return undefined
    }

    if (typeof value.name !== 'string') {
        return null
    }

    const name = value.name.trim()
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        return null
    }

    return name
}

export function parseAcceptInviteInput(value: unknown): AcceptInviteInput | null {
    if (!isRecord(value)) {
        return null
    }

    if (typeof value.token !== 'string' || typeof value.password !== 'string') {
        return null
    }

    const token = value.token.trim()
    if (
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH ||
        value.password.length < MIN_PASSWORD_LENGTH ||
        value.password.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    const name = parseOptionalName(value)
    if (name === null) {
        return null
    }

    return name === undefined
        ? {token, password: value.password}
        : {token, password: value.password, name}
}

export function parseForgotPasswordInput(value: unknown): ForgotPasswordInput | null {
    if (!isRecord(value) || typeof value.email !== 'string') {
        return null
    }

    const email = value.email.trim().toLowerCase()
    if (
        email.length === 0 ||
        email.length > MAX_EMAIL_LENGTH ||
        !EMAIL_PATTERN.test(email)
    ) {
        return null
    }

    return {email}
}

export function parseResetPasswordInput(value: unknown): ResetPasswordInput | null {
    if (!isRecord(value)) {
        return null
    }

    if (typeof value.token !== 'string' || typeof value.newPassword !== 'string') {
        return null
    }

    const token = value.token.trim()
    if (
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH ||
        value.newPassword.length < MIN_PASSWORD_LENGTH ||
        value.newPassword.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    return {token, newPassword: value.newPassword}
}

export interface RefreshTokenInput {
    refresh_token: string
}

export function parseRefreshTokenInput(value: unknown): RefreshTokenInput | null {
    if (!isRecord(value) || typeof value.refresh_token !== 'string') {
        return null
    }

    const refreshToken = value.refresh_token.trim()
    if (
        refreshToken.length === 0 ||
        refreshToken.length > MAX_OAUTH_TOKEN_LENGTH ||
        /\s/.test(refreshToken)
    ) {
        return null
    }

    return {refresh_token: refreshToken}
}
