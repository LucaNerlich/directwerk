import {describe, expect, it} from 'vitest'

import {
    deskAccess,
    rbacEntityLabel,
    rbacErrorMessage,
    rbacOperationLabel,
    restrictionAccess,
    restrictionsFromAccess,
} from '@/lib/rbac/access'

describe('rbac access helpers', () => {
    it('labels entities and operations in German', () => {
        expect(rbacEntityLabel('EPISODE')).toBe('Folgen')
        expect(rbacEntityLabel('MEDIA_FOLDER')).toBe('Ordner')
        expect(rbacOperationLabel('PUBLISH')).toBe('Veröffentlichen')
        expect(rbacOperationLabel('MOVE')).toBe('Verschieben')
    })

    it('maps backend denial messages to German', () => {
        expect(rbacErrorMessage(new Error('This operation is restricted to the content creator'))).toBe(
            'Diese Aktion ist auf eigene Inhalte beschränkt.',
        )
        expect(
            rbacErrorMessage(new Error('This operation was restricted for your account by a tenant admin')),
        ).toBe(
            'Diese Aktion wurde für dein Konto eingeschränkt. Wende dich an einen Tenant-Admin.',
        )
        expect(rbacErrorMessage(new Error('NOT_CONTENT_OWNER'))).toBe(
            'Diese Aktion ist auf eigene Inhalte beschränkt.',
        )
        expect(rbacErrorMessage(new Error('OPERATION_DENIED_BY_POLICY'))).toBe(
            'Diese Aktion wurde für dein Konto eingeschränkt. Wende dich an einen Tenant-Admin.',
        )
        expect(rbacErrorMessage(new Error('boom'))).toBe('boom')
    })

    it('reads tri-state access from restriction rows', () => {
        const rows = [
            {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
            {entityType: 'EPISODE', operation: 'UPDATE', scope: 'OTHERS_ONLY'},
        ] as Parameters<typeof restrictionAccess>[0]
        expect(restrictionAccess(rows, 'EPISODE', 'DELETE')).toBe('DENIED')
        expect(restrictionAccess(rows, 'EPISODE', 'UPDATE')).toBe('OWN_ONLY')
        expect(restrictionAccess(rows, 'EPISODE', 'PUBLISH')).toBe('FULL')
        expect(restrictionAccess(rows, 'ARTICLE', 'DELETE')).toBe('FULL')
    })

    it('builds minimal PUT payloads from tri-state selections', () => {
        expect(
            restrictionsFromAccess({
                EPISODE: {DELETE: 'DENIED', UPDATE: 'OWN_ONLY', PUBLISH: 'FULL', CREATE: 'OWN_ONLY'},
                ARTICLE: {READ: 'DENIED'},
            }),
        ).toEqual([
            {entityType: 'EPISODE', operation: 'UPDATE', scope: 'OTHERS_ONLY'},
            {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
        ])
    })

    it('resolves desk access permissively without rights data', () => {
        const access = deskAccess({
            effective: null,
            entity: 'EPISODE',
            ownerUserId: 99,
            myUserId: 5,
            kind: 'Folge',
        })
        expect(access.canCreate).toBe(true)
        expect(access.canEdit).toBe(true)
        expect(access.canPublish).toBe(true)
        expect(access.canDelete).toBe(true)
    })

    it('uses the supplied localized messages for blocked reasons', () => {
        const access = deskAccess({
            effective: {EPISODE: {CREATE: 'DENIED', UPDATE: 'OWN_ONLY'}},
            entity: 'EPISODE',
            ownerUserId: 99,
            myUserId: 5,
            kind: 'Folge',
            messages: {
                verbs: {create: 'Create', edit: 'Edit', publish: 'Publish', delete: 'Delete'},
                verbsInfinitive: {
                    create: 'create',
                    edit: 'edit',
                    publish: 'publish',
                    delete: 'delete',
                },
                denied: '${verb} was restricted for your account. Contact a tenant admin.',
                ownOnly: '${verb} is limited to your own ${plural}.',
                foreignOnly: 'You can only ${verbInfinitive} your own ${plural}.',
                plural: 'episodes',
            },
        })

        expect(access.createBlockedReason).toBe(
            'Create was restricted for your account. Contact a tenant admin.',
        )
        expect(access.editBlockedReason).toBe('You can only edit your own episodes.')
    })

    it('blocks denied and foreign own-only operations with reasons', () => {
        const access = deskAccess({
            effective: {
                EPISODE: {
                    CREATE: 'DENIED',
                    UPDATE: 'OWN_ONLY',
                    PUBLISH: 'DENIED',
                    DELETE: 'FULL',
                },
            },
            entity: 'EPISODE',
            ownerUserId: 99,
            myUserId: 5,
            kind: 'Folge',
        })
        expect(access.canCreate).toBe(false)
        expect(access.createBlockedReason).toContain('eingeschränkt')
        expect(access.canEdit).toBe(false)
        expect(access.editBlockedReason).toContain('eigene Folgen')
        expect(access.canPublish).toBe(false)
        expect(access.publishBlockedReason).toContain('eingeschränkt')
        expect(access.canDelete).toBe(true)
    })

    it('allows own content under own-only rights and legacy rows stay blocked', () => {
        const effective = {EPISODE: {UPDATE: 'OWN_ONLY'}} as Parameters<typeof deskAccess>[0]['effective']
        expect(
            deskAccess({effective, entity: 'EPISODE', ownerUserId: 5, myUserId: 5, kind: 'Folge'})
                .canEdit,
        ).toBe(true)
        expect(
            deskAccess({effective, entity: 'EPISODE', ownerUserId: null, myUserId: 5, kind: 'Folge'})
                .canEdit,
        ).toBe(false)
        expect(
            deskAccess({effective, entity: 'EPISODE', ownerUserId: 99, myUserId: null, kind: 'Folge'})
                .canEdit,
        ).toBe(true)
    })
})
