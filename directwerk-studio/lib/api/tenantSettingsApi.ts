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

export async function getBranding(tenantHost: string): Promise<TenantBranding> {
    return studioGet(
        '/api/proxy/tenant/branding',
        tenantHost,
        parseBrandingEnvelope,
        invalidBrandingMessage,
    )
}

export async function updateBranding(
    tenantHost: string,
    input: UpdateTenantBrandingInput,
): Promise<TenantBranding> {
    return studioMutate(
        '/api/proxy/tenant/branding',
        tenantHost,
        jsonInit('PUT', input),
        parseBrandingEnvelope,
        invalidBrandingMessage,
    )
}

export async function listDomains(tenantHost: string): Promise<TenantDomain[]> {
    return studioGet(
        '/api/proxy/tenant/domains',
        tenantHost,
        parseDomainListEnvelope,
        'Der Server hat eine ungültige Domainliste gesendet.',
    )
}

export async function addDomain(
    tenantHost: string,
    input: AddTenantDomainInput,
): Promise<TenantDomain> {
    return studioMutate(
        '/api/proxy/tenant/domains',
        tenantHost,
        jsonInit('POST', {
            host: input.host,
            isPrimary: input.isPrimary === true,
        }),
        parseDomainEnvelope,
        invalidDomainMessage,
    )
}

export async function getDomainVerification(
    tenantHost: string,
    host: string,
): Promise<DomainVerificationChallenge> {
    return studioGet(
        `/api/proxy/tenant/domains/${encodeURIComponent(host)}/verification`,
        tenantHost,
        parseDomainVerificationEnvelope,
        'Der Server hat ungültige Domain-Verifizierung gesendet.',
    )
}

export async function verifyDomain(
    tenantHost: string,
    host: string,
): Promise<TenantDomain> {
    return studioMutate(
        `/api/proxy/tenant/domains/${encodeURIComponent(host)}/verify`,
        tenantHost,
        jsonInit('POST', {}),
        parseDomainEnvelope,
        invalidDomainMessage,
    )
}

export async function listTenantUsers(tenantHost: string): Promise<TenantUser[]> {
    return studioGet(
        '/api/proxy/tenant/users',
        tenantHost,
        parseTenantUserListEnvelope,
        'Der Server hat eine ungültige Benutzerliste gesendet.',
    )
}

export async function inviteTenantUser(
    tenantHost: string,
    input: InviteTenantUserInput,
): Promise<InviteTenantUserResponse> {
    return studioMutate(
        '/api/proxy/tenant/users/invite',
        tenantHost,
        jsonInit('POST', input),
        parseInviteTenantUserEnvelope,
        'Der Server hat eine ungültige Einladung gesendet.',
    )
}

export async function deactivateTenantUser(
    tenantHost: string,
    userId: number,
): Promise<TenantUser> {
    return studioMutate(
        `/api/proxy/tenant/users/${userId}/deactivate`,
        tenantHost,
        {method: 'POST'},
        parseTenantUserEnvelope,
        invalidUserMessage,
    )
}

export async function reactivateTenantUser(
    tenantHost: string,
    userId: number,
): Promise<TenantUser> {
    return studioMutate(
        `/api/proxy/tenant/users/${userId}/reactivate`,
        tenantHost,
        {method: 'POST'},
        parseTenantUserEnvelope,
        invalidUserMessage,
    )
}

export async function listUserRestrictions(
    tenantHost: string,
    userId: number,
): Promise<PermissionRestriction[]> {
    return studioGet(
        `/api/proxy/tenant/users/${userId}/restrictions`,
        tenantHost,
        parsePermissionRestrictionListEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function replaceUserRestrictions(
    tenantHost: string,
    userId: number,
    restrictions: PermissionRestriction[],
): Promise<PermissionRestriction[]> {
    return studioMutate(
        `/api/proxy/tenant/users/${userId}/restrictions`,
        tenantHost,
        jsonInit('PUT', {restrictions}),
        parsePermissionRestrictionListEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function getUserEffectiveRights(
    tenantHost: string,
    userId: number,
): Promise<EffectiveRights> {
    return studioGet(
        `/api/proxy/tenant/users/${userId}/effective-rights`,
        tenantHost,
        parseEffectiveRightsEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function getMyEffectiveRights(tenantHost: string): Promise<EffectiveRights> {
    return studioGet(
        '/api/proxy/me/effective-rights',
        tenantHost,
        parseEffectiveRightsEnvelope,
        'Der Server hat ungültige Rechtdaten gesendet.',
    )
}

export async function listSubscribers(
    tenantHost: string,
): Promise<TenantSubscriber[]> {
    return studioGet(
        '/api/proxy/tenant/subscribers',
        tenantHost,
        parseSubscriberListEnvelope,
        'Der Server hat eine ungültige Abonnentenliste gesendet.',
    )
}

export async function getContentEmailTemplate(
    tenantHost: string,
    contentType: ContentEmailTemplateType,
): Promise<ContentEmailTemplate | null> {
    return studioGet(
        `/api/proxy/tenant/content-email-templates/${contentType}`,
        tenantHost,
        parseContentEmailTemplateEnvelope,
        invalidTemplateMessage,
    )
}

export async function upsertContentEmailTemplate(
    tenantHost: string,
    contentType: ContentEmailTemplateType,
    input: UpsertContentEmailTemplateInput,
): Promise<ContentEmailTemplate> {
    const result = await studioMutate(
        `/api/proxy/tenant/content-email-templates/${contentType}`,
        tenantHost,
        jsonInit('PUT', input),
        parseContentEmailTemplateEnvelope,
        invalidTemplateMessage,
    )
    if (result === null) {
        throw new Error(invalidTemplateMessage)
    }
    return result
}
