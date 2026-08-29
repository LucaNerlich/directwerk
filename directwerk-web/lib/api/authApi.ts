'use client'

import {parseTokenResponse} from '@directwerk/api/validation/token'

import type {
    TokenResponse,
} from '@directwerk/api/types'
import type {
    AcceptInviteInput,
    ForgotPasswordInput,
    LoginInput,
    RegisterInput,
    ResetPasswordInput,
} from '@directwerk/api/validation/input'
import {
    postJson,
} from './transport'

export async function register(
    tenantHost: string,
    input: RegisterInput,
): Promise<void> {
    await postJson('/api/auth/register', tenantHost, input)
}

export async function acceptInvite(input: AcceptInviteInput): Promise<void> {
    await postJson('/api/auth/accept-invite', null, input)
}

export async function forgotPassword(
    input: ForgotPasswordInput,
): Promise<{devResetToken: string | null}> {
    const value = await postJson('/api/auth/forgot-password', null, input)

    if (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        typeof value.data === 'object' &&
        value.data !== null &&
        'devResetToken' in value.data &&
        typeof value.data.devResetToken === 'string' &&
        value.data.devResetToken.length > 0 &&
        value.data.devResetToken.length <= 512
    ) {
        return {devResetToken: value.data.devResetToken}
    }

    return {devResetToken: null}
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
    await postJson('/api/auth/reset-password', null, input)
}

export async function login(
    tenantHost: string,
    input: LoginInput,
): Promise<TokenResponse> {
    const value = await postJson('/api/auth/login', tenantHost, input)
    const tokens = parseTokenResponse(value)
    if (tokens === null) {
        throw new Error('The server returned an invalid token response.')
    }

    return tokens
}
