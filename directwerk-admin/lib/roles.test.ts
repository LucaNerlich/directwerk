import {describe, expect, it} from 'vitest'

import {getTenantRoleLabel, isTenantInvitableRole} from './roles'

describe('isTenantInvitableRole', () => {
    it('accepts the invitable roles offered by the admin UI', () => {
        expect(isTenantInvitableRole('TENANT_ADMIN')).toBe(true)
        expect(isTenantInvitableRole('EDITOR')).toBe(true)
    })

    it('rejects elevated, reader, and malformed roles', () => {
        expect(isTenantInvitableRole('PLATFORM_ADMIN')).toBe(false)
        expect(isTenantInvitableRole('SUBSCRIBER')).toBe(false)
        expect(isTenantInvitableRole('GUEST')).toBe(false)
        expect(isTenantInvitableRole('')).toBe(false)
        expect(isTenantInvitableRole(null)).toBe(false)
        expect(isTenantInvitableRole(undefined)).toBe(false)
        expect(isTenantInvitableRole(42)).toBe(false)
    })
})

describe('getTenantRoleLabel', () => {
    it('labels every known tenant role in English', () => {
        expect(getTenantRoleLabel('TENANT_ADMIN')).toBe('Tenant admin')
        expect(getTenantRoleLabel('EDITOR')).toBe('Editor')
        expect(getTenantRoleLabel('SUBSCRIBER')).toBe('Subscriber')
        expect(getTenantRoleLabel('GUEST')).toBe('Guest')
    })
})
