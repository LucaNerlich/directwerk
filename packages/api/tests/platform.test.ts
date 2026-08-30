import {describe, expect, it} from 'vitest'

import {buildSafePlatformQueryString} from '../src/server/platform'

describe('buildSafePlatformQueryString', () => {
    it('allows overview query params including recentAuditLimit', () => {
        const params = new URLSearchParams({recentAuditLimit: '8'})
        expect(buildSafePlatformQueryString(params)).toBe('?recentAuditLimit=8')
    })

    it('allows audit list pagination params', () => {
        const params = new URLSearchParams({page: '0', size: '50'})
        expect(buildSafePlatformQueryString(params)).toBe('?page=0&size=50')
    })

    it('allows audit list filters', () => {
        const params = new URLSearchParams({
            page: '0',
            size: '20',
            tenantId: '42',
            action: 'TENANT_CREATED',
            actorEmail: 'admin@example.com',
            actorUserId: '7',
        })
        expect(buildSafePlatformQueryString(params)).toBe(
            '?page=0&size=20&tenantId=42&action=TENANT_CREATED&actorEmail=admin%40example.com&actorUserId=7',
        )
    })

    it('rejects unknown query params', () => {
        const params = new URLSearchParams({recentAuditLimit: '8', evil: '1'})
        expect(() => buildSafePlatformQueryString(params)).toThrow(
            'Invalid platform API query.',
        )
    })

    it('rejects recentAuditLimit outside API bounds', () => {
        expect(() =>
            buildSafePlatformQueryString(
                new URLSearchParams({recentAuditLimit: '0'}),
            ),
        ).toThrow('Invalid platform API query.')
        expect(() =>
            buildSafePlatformQueryString(
                new URLSearchParams({recentAuditLimit: '51'}),
            ),
        ).toThrow('Invalid platform API query.')
    })
})
