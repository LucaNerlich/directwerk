'use client'

import type {
    EffectiveRights,
    PermissionRestriction,
    RbacEffectiveAccess,
    RbacEntityType,
    RbacOperation,
    RbacRestrictionScope,
} from '@directwerk/api/types'
import {
    RBAC_ENTITY_TYPES,
    RBAC_OWN_ONLY_OPERATIONS,
    RBAC_RESTRICTABLE_OPERATIONS,
} from '@directwerk/api/types'

export function rbacEntityLabel(entity: RbacEntityType): string {
    switch (entity) {
        case 'EPISODE':
            return 'Folgen'
        case 'ARTICLE':
            return 'Beiträge'
        case 'SERIES':
            return 'Sendungen'
        case 'MEDIA_ASSET':
            return 'Medien'
        case 'MEDIA_FOLDER':
            return 'Ordner'
    }
}

export function rbacOperationLabel(operation: RbacOperation): string {
    switch (operation) {
        case 'CREATE':
            return 'Anlegen'
        case 'READ':
            return 'Lesen'
        case 'UPDATE':
            return 'Bearbeiten'
        case 'DELETE':
            return 'Löschen'
        case 'PUBLISH':
            return 'Veröffentlichen'
        case 'SCHEDULE':
            return 'Planen'
        case 'UNPUBLISH':
            return 'Zurückziehen'
        case 'ARCHIVE':
            return 'Archivieren'
        case 'UNARCHIVE':
            return 'Wiederherstellen'
        case 'MOVE':
            return 'Verschieben'
    }
}

export function rbacAccessLabel(access: RbacEffectiveAccess): string {
    switch (access) {
        case 'FULL':
            return 'Vollzugriff'
        case 'OWN_ONLY':
            return 'Nur eigene'
        case 'DENIED':
            return 'Kein Zugriff'
    }
}

/**
 * Maps RBAC API failures to German UI messages. The API is English-first for
 * integrators, so known failure modes are recognized by their stable message
 * fragments; unknown errors surface verbatim.
 */
export function rbacErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'
    if (
        message.includes('restricted to the content creator') ||
        message.includes('NOT_CONTENT_OWNER')
    ) {
        return 'Diese Aktion ist auf eigene Inhalte beschränkt.'
    }
    if (
        message.includes('was restricted for your account') ||
        message.includes('OPERATION_DENIED_BY_POLICY')
    ) {
        return 'Diese Aktion wurde für dein Konto eingeschränkt. Wende dich an einen Tenant-Admin.'
    }
    return message
}

/**
 * Tri-state access of one (entity, operation) pair from restriction rows.
 * Used by the team rights editor; the API validates authoritatively.
 */
export function restrictionAccess(
    restrictions: PermissionRestriction[],
    entity: RbacEntityType,
    operation: RbacOperation,
): RbacEffectiveAccess {
    let ownOnly = false
    for (const restriction of restrictions) {
        if (restriction.entityType !== entity || restriction.operation !== operation) {
            continue
        }
        if (restriction.scope === 'DENY') {
            return 'DENIED'
        }
        ownOnly = true
    }
    return ownOnly ? 'OWN_ONLY' : 'FULL'
}

/**
 * Builds the PUT payload from tri-state UI selections. Selections equal to the
 * baseline (FULL, or invalid combinations like OWN_ONLY on CREATE) produce no rows.
 */
export function restrictionsFromAccess(
    selections: Partial<Record<RbacEntityType, Partial<Record<RbacOperation, RbacEffectiveAccess>>>>,
): PermissionRestriction[] {
    const restrictions: PermissionRestriction[] = []
    for (const entity of RBAC_ENTITY_TYPES) {
        for (const operation of RBAC_RESTRICTABLE_OPERATIONS) {
            const access = selections[entity]?.[operation] ?? 'FULL'
            if (access === 'FULL') {
                continue
            }
            if (access === 'OWN_ONLY' && !RBAC_OWN_ONLY_OPERATIONS.includes(operation)) {
                continue
            }
            const scope: RbacRestrictionScope = access === 'DENIED' ? 'DENY' : 'OTHERS_ONLY'
            restrictions.push({entityType: entity, operation, scope})
        }
    }
    return restrictions
}

export interface DeskAccess {
    canEdit: boolean
    editBlockedReason: string | null
    canPublish: boolean
    publishBlockedReason: string | null
    canDelete: boolean
}

function effectiveAccessOf(
    effective: EffectiveRights['effective'] | null,
    entity: RbacEntityType,
    operation: RbacOperation,
): RbacEffectiveAccess {
    return effective?.[entity]?.[operation] ?? 'FULL'
}

/**
 * Computes desk permissions from the server-resolved rights matrix.
 *
 * UI adaptation is convenience-only — the backend enforces authoritatively per
 * row. Unknown state (rights failed to load, unknown owner, unknown user id)
 * resolves permissively except for own-only rights on unknown owners, which
 * mirror the backend's fail-closed NOT_CONTENT_OWNER.
 *
 * @param kind publication kind label for messages ("Folge" or "Beitrag").
 */
export function deskAccess({
    effective,
    entity,
    ownerUserId,
    myUserId,
    kind,
}: {
    effective: EffectiveRights['effective'] | null
    entity: RbacEntityType
    ownerUserId: number | null
    myUserId: number | null
    kind: string
}): DeskAccess {
    const isOwn = myUserId === null || ownerUserId === null ? null : ownerUserId === myUserId

    function check(operation: RbacOperation, verb: string, verbInfinitive: string): {allowed: boolean; reason: string | null} {
        const access = effectiveAccessOf(effective, entity, operation)
        if (access === 'FULL') {
            return {allowed: true, reason: null}
        }
        if (access === 'DENIED') {
            return {
                allowed: false,
                reason: `${verb} wurde für dein Konto eingeschränkt. Wende dich an einen Tenant-Admin.`,
            }
        }
        // OWN_ONLY: unknown user id resolves permissively (the backend decides
        // authoritatively); unknown/foreign owners stay blocked like the backend.
        if (myUserId === null || isOwn === true) {
            return {allowed: true, reason: null}
        }
        const plural = kind === 'Folge' ? 'Folgen' : 'Beiträge'
        return {
            allowed: false,
            reason:
                ownerUserId === null
                    ? `${verb} ist auf eigene ${plural} beschränkt.`
                    : `Du kannst nur eigene ${plural} ${verbInfinitive}.`,
        }
    }

    const edit = check('UPDATE', 'Bearbeiten', 'bearbeiten')
    const publish = check('PUBLISH', 'Veröffentlichen', 'veröffentlichen')
    const deletion = check('DELETE', 'Löschen', 'löschen')

    return {
        canEdit: edit.allowed,
        editBlockedReason: edit.reason,
        canPublish: publish.allowed,
        publishBlockedReason: publish.reason,
        canDelete: deletion.allowed,
    }
}
