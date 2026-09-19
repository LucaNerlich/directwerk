'use client'

import {
    parseEspConnectionEnvelope,
    parseIntegrationsStatusEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    ConnectMailgunInput,
    EspConnection,
    IntegrationsStatus,
} from '@directwerk/api/types'
import {jsonInit, studioDelete, studioGet, studioMutate} from './studioApiCore'

const invalidStatusMessage =
    'Der Server hat einen ungültigen Integrations-Status gesendet.'
const invalidEspMessage =
    'Der Server hat ungültige Mailgun-Verbindungsdaten gesendet.'

export async function getIntegrationsStatus(
    tenantHost: string,
): Promise<IntegrationsStatus> {
    return studioGet(
        '/api/proxy/tenant/integrations/status',
        tenantHost,
        parseIntegrationsStatusEnvelope,
        invalidStatusMessage,
    )
}

export async function getEspConnection(
    tenantHost: string,
): Promise<EspConnection | null> {
    return studioGet(
        '/api/proxy/tenant/integrations/esp',
        tenantHost,
        parseEspConnectionEnvelope,
        invalidEspMessage,
    )
}

export async function connectMailgun(
    tenantHost: string,
    input: ConnectMailgunInput,
): Promise<EspConnection> {
    return studioMutate(
        '/api/proxy/tenant/integrations/esp/mailgun',
        tenantHost,
        jsonInit('PUT', input),
        (value) => {
            const envelope = parseEspConnectionEnvelope(value)
            if (envelope === null || envelope.data === null) {
                return null
            }
            return {data: envelope.data}
        },
        invalidEspMessage,
    )
}

export async function disconnectEsp(tenantHost: string): Promise<void> {
    return studioDelete('/api/proxy/tenant/integrations/esp', tenantHost)
}
