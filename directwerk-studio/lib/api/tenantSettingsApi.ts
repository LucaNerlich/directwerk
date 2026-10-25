'use client'

import {parseBrandingEnvelope, parseContentEmailTemplateEnvelope, parseDomainEnvelope, parseDomainListEnvelope, parseDomainVerificationEnvelope, parseEffectiveRightsEnvelope, parseInviteTenantUserEnvelope, parsePermissionRestrictionListEnvelope, parseSubscriberDirectoryPage, parseTenantUserDirectoryPage, parseTenantUserEnvelope} from '@directwerk/api/validation/catalog'

import type {
    ContentEmailTemplate,
    ContentEmailTemplateType,
    DirectoryListPage,
    DomainVerificationChallenge,
    EffectiveRights,
    InviteTenantUserInput,
    InviteTenantUserResponse,
    PermissionRestriction,
    TenantBranding,
    TenantDomain,
    TenantSubscriber,
    TenantSubscriberListQuery,
    TenantUser,
    TenantUserListQuery,
    UpdateTenantBrandingInput,
    UpsertContentEmailTemplateInput,
    AddTenantDomainInput,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'
import {authenticatedRequest} from './studioTransport'

function directoryQueryString(query?: TenantUserListQuery | TenantSubscriberListQuery): string {
    if (query === undefined) {
        return ''
    }
    const params = new URLSearchParams()
    if (query.page !== undefined) {
        params.set('page', String(query.page))
    }
    if (query.size !== undefined) {
        params.set('size', String(query.size))
    }
    const trimmed = query.q?.trim() ?? ''
    if (trimmed.length > 0) {
        params.set('q', trimmed)
    }
    const encoded = params.toString()
    return encoded.length > 0 ? `?${encoded}` : ''
}

const invalidBrandingMessage = 'Der Server hat ungültige Branding-Daten gesendet.'
const invalidDomainMessage = 'Der Server hat eine ungültige Domain gesendet.'
const invalidUserMessage = 'Der Server hat ungültige Benutzerdaten gesendet.'
const invalidTemplateMessage = 'Der Server hat ungültige E-Mail-Vorlagen gesendet.'

export async function getBranding(): Promise<TenantBranding> {
    return studioGet(
        '/api/proxy/tenant/branding',
        
        parseBrandingEnvelope,
        invalidBrandingMessage,
    )
}

export async function updateBranding(
        input: UpdateTenantBrandingInput,
): Promise<TenantBranding> {
    return studioMutate(
        '/api/proxy/tenant/branding',
        
        jsonInit('PUT', input),
        parseBrandingEnvelope,
        invalidBrandingMessage,
    )
}

export async function listDomains(): Promise<TenantDomain[]> {
    return studioGet(
        '/api/proxy/tenant/domains',
        
        parseDomainListEnvelope,
        'Der Server hat eine ungültige Domainliste gesendet.',
    )
}

export async function addDomain(
        input: AddTenantDomainInput,
): Promise<TenantDomain> {
    return studioMutate(
        '/api/proxy/tenant/domains',
        
        jsonInit('POST', {
            host: input.host,
            isPrimary: input.isPrimary === true,
        }),
        parseDomainEnvelope,
        invalidDomainMessage,
    )
}

export async function getDomainVerification(
        host: string,
): Promise<DomainVerificationChallenge> {
    return studioGet(
        `/api/proxy/tenant/domains/${encodeURIComponent(host)}/verification`,
        
        parseDomainVerificationEnvelope,
        'Der Server hat ungültige Domain-Verifizierung gesendet.',
    )
}

export async function verifyDomain(
        host: string,
): Promise<TenantDomain> {
    return studioMutate(
        `/api/proxy/tenant/domains/${encodeURIComponent(host)}/verify`,
        
        jsonInit('POST', {}),
        parseDomainEnvelope,
        invalidDomainMessage,
    )
}

export async function listTenantUsers(
    query?: TenantUserListQuery,
): Promise<DirectoryListPage<TenantUser>> {
    const raw = await authenticatedRequest(
        `/api/proxy/tenant/users${directoryQueryString(query)}`,
        '',
    )
    const parsed = parseTenantUserDirectoryPage(raw)
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Benutzerliste gesendet.')
    }
    return parsed
}

export async function inviteTenantUser(
        input: InviteTenantUserInput,
): Promise<InviteTenantUserResponse> {
    return studioMutate(
        '/api/proxy/tenant/users/invite',
        
        jsonInit('POST', input),
        parseInviteTenantUserEnvelope,
        'Der Server hat eine ungültige Einladung gesendet.',
    )
}

export async function deactivateTenantUser(
        userId: number,
): Promise<TenantUser> {
    return studioMutate(
        `/api/proxy/tenant/users/${userId}/deactivate`,
        
        {method: 'POST'},
        parseTenantUserEnvelope,
        invalidUserMessage,
    )
}

export async function reactivateTenantUser(
        userId: number,
): Promise<TenantUser> {
    return studioMutate(
        `/api/proxy/tenant/users/${userId}/reactivate`,
        
        {method: 'POST'},
        parseTenantUserEnvelope,
        invalidUserMessage,
    )
}

export async function listUserRestrictions(
        userId: number,
): Promise<PermissionRestriction[]> {
    return studioGet(
        `/api/proxy/tenant/users/${userId}/restrictions`,
        
        parsePermissionRestrictionListEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function replaceUserRestrictions(
        userId: number,
    restrictions: PermissionRestriction[],
): Promise<PermissionRestriction[]> {
    return studioMutate(
        `/api/proxy/tenant/users/${userId}/restrictions`,
        
        jsonInit('PUT', {restrictions}),
        parsePermissionRestrictionListEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function getMyEffectiveRights(): Promise<EffectiveRights> {
    return studioGet(
        '/api/proxy/me/effective-rights',
        
        parseEffectiveRightsEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function listSubscribers(
    query?: TenantSubscriberListQuery,
): Promise<DirectoryListPage<TenantSubscriber>> {
    const raw = await authenticatedRequest(
        `/api/proxy/tenant/subscribers${directoryQueryString(query)}`,
        '',
    )
    const parsed = parseSubscriberDirectoryPage(raw)
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Abonnentenliste gesendet.')
    }
    return parsed
}

/** Pages through the subscriber directory until every matching row is collected. */
export async function listAllSubscribers(
    query?: Pick<TenantSubscriberListQuery, 'q'>,
): Promise<TenantSubscriber[]> {
    const collected: TenantSubscriber[] = []
    let page = 0
    const size = 100
    for (;;) {
        const result = await listSubscribers({
            page,
            size,
            ...(query?.q !== undefined ? {q: query.q} : {}),
        })
        collected.push(...result.content)
        if (collected.length >= result.totalElements || result.content.length === 0) {
            break
        }
        page += 1
    }
    return collected
}

export async function getContentEmailTemplate(
        contentType: ContentEmailTemplateType,
): Promise<ContentEmailTemplate | null> {
    return studioGet(
        `/api/proxy/tenant/content-email-templates/${contentType}`,
        
        parseContentEmailTemplateEnvelope,
        invalidTemplateMessage,
    )
}

export async function upsertContentEmailTemplate(
        contentType: ContentEmailTemplateType,
    input: UpsertContentEmailTemplateInput,
): Promise<ContentEmailTemplate> {
    const result = await studioMutate(
        `/api/proxy/tenant/content-email-templates/${contentType}`,
        
        jsonInit('PUT', input),
        parseContentEmailTemplateEnvelope,
        invalidTemplateMessage,
    )
    if (result === null) {
        throw new Error(invalidTemplateMessage)
    }
    return result
}
