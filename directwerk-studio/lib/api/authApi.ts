'use client'

import {parseMeEnvelope} from '@directwerk/api/validation/catalog'
import {parseTokenResponse} from '@directwerk/api/validation/token'

import {parseStudioWorkspacesEnvelope} from '@directwerk/api/validation/catalog'

import type {AcceptInviteInput, LoginInput} from '@directwerk/api/validation/input'
import type {Me, StudioWorkspace, TokenResponse} from '@directwerk/api/types'
import {postJson, studioGet} from './studioApiCore'

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
    // Issue #338: the only lib fetch that bypassed the shared transport. On a network failure
    // fetch rejects with a raw TypeError, which the login page rendered verbatim as
    // "Failed to fetch"/"Load failed" instead of the policy's localised transient message; it
    // also duplicated the envelope/error handling the transport already owns.
    await postJson('/api/tenant/select', null, {host})
}

/** Clears the studio tenant-host cookie so login rediscovers workspaces. */
export async function clearSelectedTenantHost(): Promise<void> {
    const response = await fetch('/api/tenant/select', {
        method: 'DELETE',
        cache: 'no-store',
    })
    if (!response.ok) {
        throw new Error('tenant-host-clear-failed')
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

export async function fetchMe(): Promise<Me> {
    return studioGet(
        '/api/proxy/me',
        
        parseMeEnvelope,
        'Der Server hat eine ungültige Kontodaten-Antwort gesendet.',
    )
}
