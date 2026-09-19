'use client'

import {
    parseDigitalPublicationEnvelope,
    parseDigitalPublicationListEnvelope,
} from '@directwerk/api/validation/catalog'

import type {
    CreateDigitalPublicationInput,
    DigitalPublication,
    UpdateDigitalPublicationInput,
} from '@directwerk/api/types'
import {jsonInit, studioDelete, studioGet, studioMutate} from './studioApiCore'

const basePath = '/api/proxy/digital-publications'
const invalidListMessage = 'Der Server hat eine ungültige Bonusdatei-Liste gesendet.'
const invalidDetailMessage = 'Der Server hat eine ungültige Bonusdatei gesendet.'

export async function listDigitalPublications(
    tenantHost: string,
): Promise<DigitalPublication[]> {
    return studioGet(
        basePath,
        tenantHost,
        parseDigitalPublicationListEnvelope,
        invalidListMessage,
    )
}

export async function getDigitalPublication(
    tenantHost: string,
    publicationId: number,
): Promise<DigitalPublication> {
    return studioGet(
        `${basePath}/${publicationId}`,
        tenantHost,
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function createDigitalPublication(
    tenantHost: string,
    input: CreateDigitalPublicationInput,
): Promise<DigitalPublication> {
    return studioMutate(
        basePath,
        tenantHost,
        jsonInit('POST', input),
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function updateDigitalPublication(
    tenantHost: string,
    publicationId: number,
    input: UpdateDigitalPublicationInput,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function publishDigitalPublication(
    tenantHost: string,
    publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/publish`,
        tenantHost,
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function unpublishDigitalPublication(
    tenantHost: string,
    publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/unpublish`,
        tenantHost,
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function archiveDigitalPublication(
    tenantHost: string,
    publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/archive`,
        tenantHost,
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function unarchiveDigitalPublication(
    tenantHost: string,
    publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/unarchive`,
        tenantHost,
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function deleteDigitalPublication(
    tenantHost: string,
    publicationId: number,
): Promise<void> {
    return studioDelete(`${basePath}/${publicationId}`, tenantHost)
}
