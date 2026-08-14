import {describe, expect, it} from 'vitest'

import {
    validateCreateTenantInput,
    validateJobListQuery,
    validateLoginInput,
    validatePlatformAdminInviteInput,
    validateTenantUserInviteInput,
} from './validation'

describe('validateLoginInput', () => {
    it('accepts a normalized email and bounded password', () => {
        expect(
            validateLoginInput({
                email: '  platform-admin@directwerk.local ',
                password: 'ChangeMe-Dev-Seed!',
            })
        ).toEqual({
            success: true,
            data: {
                email: 'platform-admin@directwerk.local',
                password: 'ChangeMe-Dev-Seed!',
            },
        })
    })

    it('rejects malformed input', () => {
        expect(
            validateLoginInput({
                email: 'not-an-email',
                password: '',
            })
        ).toEqual({
            success: false,
            error: 'Enter a valid email address and password.',
        })
    })

    it('rejects unexpected properties', () => {
        expect(
            validateLoginInput({
                email: 'platform-admin@directwerk.local',
                password: 'ChangeMe-Dev-Seed!',
                tenantHost: 'alpha-a.localhost',
            })
        ).toEqual({
            success: false,
            error: 'Invalid login request.',
        })
    })
})

describe('validateTenantUserInviteInput', () => {
    it('accepts a normalized tenant user invite', () => {
        expect(
            validateTenantUserInviteInput({
                email: '  editor@alpha-show.local ',
                name: '  New Editor ',
                role: 'EDITOR',
            })
        ).toEqual({
            success: true,
            data: {
                email: 'editor@alpha-show.local',
                name: 'New Editor',
                role: 'EDITOR',
            },
        })
    })

    it('rejects an invalid role', () => {
        expect(
            validateTenantUserInviteInput({
                email: 'editor@alpha-show.local',
                name: 'New Editor',
                role: 'PLATFORM_ADMIN',
            })
        ).toEqual({
            success: false,
            error: 'Enter a valid email address and role.',
        })
    })
})

describe('validatePlatformAdminInviteInput', () => {
    it('accepts a normalized platform admin invite', () => {
        expect(
            validatePlatformAdminInviteInput({
                email: '  second-admin@directwerk.local ',
                name: '  Second Admin ',
            })
        ).toEqual({
            success: true,
            data: {
                email: 'second-admin@directwerk.local',
                name: 'Second Admin',
            },
        })
    })

    it('rejects unexpected properties', () => {
        expect(
            validatePlatformAdminInviteInput({
                email: 'second-admin@directwerk.local',
                name: 'Second Admin',
                role: 'PLATFORM_ADMIN',
            })
        ).toEqual({
            success: false,
            error: 'Invalid invitation request.',
        })
    })
})

describe('validateJobListQuery', () => {
    it('accepts normalized queue list filters', () => {
        expect(
            validateJobListQuery({
                queue: ' email ',
                status: 'FAILED',
                offset: '0',
                limit: '20',
            })
        ).toEqual({
            success: true,
            data: {
                queue: 'email',
                status: 'FAILED',
                offset: 0,
                limit: 20,
            },
        })
    })

    it('accepts an empty filter set', () => {
        expect(validateJobListQuery({})).toEqual({
            success: true,
            data: {},
        })
    })

    it('rejects an invalid status filter', () => {
        expect(
            validateJobListQuery({
                status: 'PENDING',
            })
        ).toEqual({
            success: false,
            error: 'Enter a valid status filter.',
        })
    })

    it('rejects unexpected properties', () => {
        expect(
            validateJobListQuery({
                queue: 'email',
                worker: 'demo',
            })
        ).toEqual({
            success: false,
            error: 'Invalid job list request.',
        })
    })
})

describe('validateCreateTenantInput', () => {
    it('normalizes a valid primary domain hostname', () => {
        expect(
            validateCreateTenantInput({
                name: 'Alpha Show C',
                slug: 'alpha-show-c',
                primaryDomain: ' Alpha-C.localhost ',
            })
        ).toEqual({
            success: true,
            data: {
                name: 'Alpha Show C',
                slug: 'alpha-show-c',
                primaryDomain: 'alpha-c.localhost',
            },
        })
    })

    it('rejects a malformed primary domain', () => {
        expect(
            validateCreateTenantInput({
                name: 'Alpha Show C',
                slug: 'alpha-show-c',
                primaryDomain: 'not a host',
            })
        ).toEqual({
            success: false,
            error: 'Enter a valid primary domain.',
        })
    })
})
