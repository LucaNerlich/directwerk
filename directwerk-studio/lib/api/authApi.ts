'use client'

import {parseMeEnvelope} from '@directwerk/api/validation/catalog'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import type {LoginInput} from '@directwerk/api/validation/input'
import type {Me, TokenResponse} from '@directwerk/api/types'
import {jsonInit, postJson, studioGet} from './studioApiCore'

export async function login(
    tenantHost: string,
    input: LoginInput,
): Promise<TokenResponse> {
    const value = await postJson('/api/auth/login', tenantHost, input)
    const tokens = parseTokenResponse(value)
    if (tokens === null) {
        throw new Error('Der Server hat eine ungültige Token-Antwort gesendet.')
    }

    return tokens
}

export async function fetchMe(tenantHost: string): Promise<Me> {
    return studioGet(
        '/api/proxy/me',
        tenantHost,
        parseMeEnvelope,
        'Der Server hat eine ungültige Kontodaten-Antwort gesendet.',
    )
}
