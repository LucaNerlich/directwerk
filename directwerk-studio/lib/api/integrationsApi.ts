'use client'

import {
    parseEspConnectionEnvelope,
    parseIntegrationsStatusEnvelope,
    parseMailgunTestSendResultEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    ConnectMailgunInput,
    EspConnection,
    IntegrationsStatus,
    MailgunTestSendResult,
} from '@directwerk/api/types'
import {jsonInit, studioDelete, studioGet, studioMutate} from './studioApiCore'

const invalidStatusMessage =
    'Der Server hat einen ungültigen Integrations-Status gesendet.'
const invalidEspMessage =
    'Der Server hat ungültige Mailgun-Verbindungsdaten gesendet.'
const invalidMailgunTestMessage =
    'Der Server hat ein ungültiges Mailgun-Testergebnis gesendet.'

export async function getIntegrationsStatus(
    ): Promise<IntegrationsStatus> {
    return studioGet(
        '/api/proxy/tenant/integrations/status',
        
        parseIntegrationsStatusEnvelope,
        invalidStatusMessage,
    )
}

export async function connectMailgun(
        input: ConnectMailgunInput,
): Promise<EspConnection> {
    return studioMutate(
        '/api/proxy/tenant/integrations/esp/mailgun',
        
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

export async function disconnectEsp(): Promise<void> {
    return studioDelete('/api/proxy/tenant/integrations/esp', )
}

export async function sendMailgunTest(): Promise<MailgunTestSendResult> {
    return studioMutate(
        '/api/proxy/tenant/integrations/esp/mailgun/test',
        {method: 'POST'},
        parseMailgunTestSendResultEnvelope,
        invalidMailgunTestMessage,
    )
}
