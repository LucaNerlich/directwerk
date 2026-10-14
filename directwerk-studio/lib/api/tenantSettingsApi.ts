'use client'

import {parseBrandingEnvelope, parseContentEmailTemplateEnvelope, parseDomainEnvelope, parseDomainListEnvelope, parseDomainVerificationEnvelope, parseEffectiveRightsEnvelope, parseInviteTenantUserEnvelope, parsePermissionRestrictionListEnvelope, parseSubscriberListEnvelope, parseTenantUserEnvelope, parseTenantUserListEnvelope} from '@directwerk/api/validation/catalog'

import type {
    ContentEmailTemplate,
    ContentEmailTemplateType,
    DomainVerificationChallenge,
    EffectiveRights,
    InviteTenantUserInput,
    InviteTenantUserResponse,
    PermissionRestriction,
    TenantBranding,
    TenantDomain,
    TenantSubscriber,
    TenantUser,
    UpdateTenantBrandingInput,
    UpsertContentEmailTemplateInput,
    AddTenantDomainInput,
} from '@directwerk/api/types'
import {jsonInit, studioGet, studioMutate} from './studioApiCore'

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

export async function listTenantUsers(): Promise<TenantUser[]> {
    return studioGet(
        '/api/proxy/tenant/users',
        
        parseTenantUserListEnvelope,
        'Der Server hat eine ungültige Benutzerliste gesendet.',
    )
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
    ): Promise<TenantSubscriber[]> {
    return studioGet(
        '/api/proxy/tenant/subscribers',
        
        parseSubscriberListEnvelope,
        'Der Server hat eine ungültige Abonnentenliste gesendet.',
    )
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
