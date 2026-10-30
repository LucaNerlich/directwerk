'use client'

import {
    parseCreatedTenantApiKeyEnvelope,
    parseTenantApiKeyEnvelope,
    parseTenantApiKeyListEnvelope,
} from '@directwerk/api/validation/catalog'
import type {
    CreateTenantApiKeyInput,
    CreatedTenantApiKey,
    TenantApiKey,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'

const invalidListMessage = 'Der Server hat eine ungültige API-Schlüssel-Liste gesendet.'
const invalidKeyMessage = 'Der Server hat ungültige API-Schlüssel-Daten gesendet.'
const invalidCreatedMessage =
    'Der Server hat ungültige API-Schlüssel-Erstellungsdaten gesendet.'

export async function listApiKeys(): Promise<TenantApiKey[]> {
    return studioGet(
        '/api/proxy/tenant/api-keys',
        parseTenantApiKeyListEnvelope,
        invalidListMessage,
    )
}

export async function createApiKey(
    input: CreateTenantApiKeyInput,
): Promise<CreatedTenantApiKey> {
    return studioMutate(
        '/api/proxy/tenant/api-keys',
        jsonInit('POST', input),
        (value) => {
            const envelope = parseCreatedTenantApiKeyEnvelope(value)
            if (envelope === null || envelope.data === null) {
                return null
            }
            return {data: envelope.data}
        },
        invalidCreatedMessage,
    )
}

export async function revokeApiKey(id: number): Promise<TenantApiKey> {
    return studioMutate(
        `/api/proxy/tenant/api-keys/${id}`,
        {method: 'DELETE'},
        parseTenantApiKeyEnvelope,
        invalidKeyMessage,
    )
}
