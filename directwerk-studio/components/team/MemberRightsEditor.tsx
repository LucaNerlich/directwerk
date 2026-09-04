'use client'

import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import {
    RBAC_ENTITY_TYPES,
    RBAC_OWN_ONLY_OPERATIONS,
    RBAC_RESTRICTABLE_OPERATIONS,
    type PermissionRestriction,
    type RbacEntityType,
    type RbacOperation,
    type TenantUser,
} from '@directwerk/api/types'
import {listUserRestrictions, replaceUserRestrictions} from '@/lib/api/tenantSettingsApi'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {
    rbacAccessLabel,
    rbacEntityLabel,
    rbacErrorMessage,
    rbacOperationLabel,
    restrictionAccess,
    restrictionsFromAccess,
    type RbacAccess,
} from '@/lib/rbac/access'

type AccessMatrix = Partial<Record<RbacEntityType, Partial<Record<RbacOperation, RbacAccess>>>>

function matrixFromRestrictions(restrictions: PermissionRestriction[]): AccessMatrix {
    const matrix: AccessMatrix = {}
    for (const entity of RBAC_ENTITY_TYPES) {
        for (const operation of RBAC_RESTRICTABLE_OPERATIONS) {
            const access = restrictionAccess(restrictions, entity, operation)
            if (access !== 'FULL') {
                matrix[entity] = {...matrix[entity], [operation]: access}
            }
        }
    }
    return matrix
}

/**
 * Per-editor rights editor for tenant admins (issue #148). Tri-state per
 * restrictable (entity, operation) pair; saving replaces all rows atomically.
 * Tenant admins always keep full rights — the editor is not offered for them.
 */
export default function MemberRightsEditor({
    user,
    onAuthRequired,
}: {
    user: TenantUser
    onAuthRequired: () => void
}): React.JSX.Element {
    const [matrix, setMatrix] = useState<AccessMatrix>({})
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)

    const isEditor = user.roles.includes('EDITOR') && !user.roles.includes('TENANT_ADMIN')

    useEffect(() => {
        if (!isEditor) {
            setIsLoading(false)
            return
        }
        let active = true
        setIsLoading(true)
        setErrorMessage(null)
        listUserRestrictions(getClientTenantHost(), user.userId)
            .then((restrictions) => {
                if (active) {
                    setMatrix(matrixFromRestrictions(restrictions))
                    setIsLoading(false)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    onAuthRequired()
                    return
                }
                setErrorMessage(
                    error instanceof Error ? error.message : 'Rechte konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [isEditor, onAuthRequired, reloadToken, user.userId])

    if (!isEditor) {
        return (
            <p className="text-sm text-muted-foreground" role="note">
                {user.roles.includes('TENANT_ADMIN')
                    ? 'Tenant-Admins haben immer Vollzugriff — Einschränkungen greifen nicht.'
                    : 'Einschränkungen gelten nur für Redakteure.'}
            </p>
        )
    }

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                Rechte werden geladen…
            </p>
        )
    }

    function setAccess(entity: RbacEntityType, operation: RbacOperation, access: RbacAccess): void {
        setMatrix((current) => ({...current, [entity]: {...current[entity], [operation]: access}}))
        setStatusMessage(null)
    }

    async function handleSave(): Promise<void> {
        setIsSaving(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const saved = await replaceUserRestrictions(
                getClientTenantHost(),
                user.userId,
                restrictionsFromAccess(matrix),
            )
            setMatrix(matrixFromRestrictions(saved))
            setStatusMessage('Zugriffsrechte gespeichert.')
        } catch (error) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                onAuthRequired()
                return
            }
            setErrorMessage(rbacErrorMessage(error))
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">
                Lesen ist für Redakteure immer erlaubt. „Nur eigene“ beschränkt eine Aktion auf
                selbst erstellte Inhalte (ältere Inhalte ohne Autor zählen als fremd).
            </p>
            {RBAC_ENTITY_TYPES.map((entity) => (
                <details className="grid gap-2 rounded-lg border p-3" key={entity} open={entity === 'EPISODE'}>
                    <summary className="cursor-pointer text-sm font-medium">
                        {rbacEntityLabel(entity)}
                    </summary>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {RBAC_RESTRICTABLE_OPERATIONS.map((operation) => {
                            const supportsOwnOnly = RBAC_OWN_ONLY_OPERATIONS.includes(operation)
                            const value = matrix[entity]?.[operation] ?? 'FULL'
                            return (
                                <label className="grid gap-1 text-sm" key={operation}>
                                    <span className="font-medium">{rbacOperationLabel(operation)}</span>
                                    <select
                                        aria-label={`${rbacEntityLabel(entity)}: ${rbacOperationLabel(operation)}`}
                                        className="native-select"
                                        disabled={isSaving}
                                        onChange={(event) =>
                                            setAccess(entity, operation, event.target.value as RbacAccess)
                                        }
                                        value={value}
                                    >
                                        <option value="FULL">{rbacAccessLabel('FULL')}</option>
                                        {supportsOwnOnly ? (
                                            <option value="OWN_ONLY">{rbacAccessLabel('OWN_ONLY')}</option>
                                        ) : null}
                                        <option value="DENIED">{rbacAccessLabel('DENIED')}</option>
                                    </select>
                                </label>
                            )
                        })}
                    </div>
                </details>
            ))}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
                <Button disabled={isSaving} onClick={() => void handleSave()} type="button">
                    {isSaving ? 'Speichert…' : 'Rechte speichern'}
                </Button>
                <Button
                    disabled={isSaving}
                    onClick={() => setReloadToken((value) => value + 1)}
                    type="button"
                    variant="outline"
                >
                    Zurücksetzen
                </Button>
            </div>
        </div>
    )
}
