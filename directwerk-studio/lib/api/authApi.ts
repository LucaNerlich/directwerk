'use client'

import {parseMeEnvelope} from '@directwerk/api/validation/catalog'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {parseStudioWorkspacesEnvelope} from '@directwerk/api/validation/catalog'

import type {AcceptInviteInput, LoginInput} from '@directwerk/api/validation/input'
import type {Me, StudioWorkspace, TokenResponse} from '@directwerk/api/types'
import {jsonInit, postJson, studioGet} from './studioApiCore'

export async function acceptInvite(input: AcceptInviteInput): Promise<void> {
    await postJson('/api/auth/accept-invite', null, input)
}

export async function discoverStudioWorkspaces(
    input: LoginInput,
): Promise<StudioWorkspace[]> {
    const value = await postJson('/api/auth/studio/workspaces', null, input)
    const parsed = parseStudioWorkspacesEnvelope(value)
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Workspace-Antwort gesendet.')
    }
    return parsed.data.workspaces
}

export async function selectTenantHost(host: string): Promise<void> {
    const response = await fetch('/api/tenant/select', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({host}),
    })

    let payload: {error?: string} = {}
    const text = await response.text()
    if (text.length > 0) {
        try {
            payload = JSON.parse(text) as {error?: string}
        } catch {
            payload = {}
        }
    }

    if (!response.ok) {
        throw new Error(
            payload.error ?? 'Der Workspace konnte nicht ausgewählt werden.',
        )
    }
}

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
