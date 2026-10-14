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
    ): Promise<DigitalPublication[]> {
    return studioGet(
        basePath,
        
        parseDigitalPublicationListEnvelope,
        invalidListMessage,
    )
}

export async function getDigitalPublication(
        publicationId: number,
): Promise<DigitalPublication> {
    return studioGet(
        `${basePath}/${publicationId}`,
        
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function createDigitalPublication(
        input: CreateDigitalPublicationInput,
): Promise<DigitalPublication> {
    return studioMutate(
        basePath,
        
        jsonInit('POST', input),
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function updateDigitalPublication(
        publicationId: number,
    input: UpdateDigitalPublicationInput,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}`,
        
        jsonInit('PUT', input),
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function publishDigitalPublication(
        publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/publish`,
        
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function unpublishDigitalPublication(
        publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/unpublish`,
        
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function archiveDigitalPublication(
        publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/archive`,
        
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function unarchiveDigitalPublication(
        publicationId: number,
): Promise<DigitalPublication> {
    return studioMutate(
        `${basePath}/${publicationId}/unarchive`,
        
        {method: 'POST'},
        parseDigitalPublicationEnvelope,
        invalidDetailMessage,
    )
}

export async function deleteDigitalPublication(
        publicationId: number,
): Promise<void> {
    return studioDelete(`${basePath}/${publicationId}`, )
}
