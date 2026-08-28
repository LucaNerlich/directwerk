'use client'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import SelectControl from '@/components/studio/SelectControl'
import {
    deactivateTenantUser,
    inviteTenantUser,
    listTenantUsers,
    reactivateTenantUser,
} from '@/lib/api/tenantApi'
import {
    TENANT_INVITABLE_ROLES,
    type TenantInvitableRole,
    type TenantUser,
} from '@directwerk/api/types'
import {useMe} from '@/lib/auth/MeProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface InviteState {
    error: string | null
    success: string | null
    inviteToken: string | null
}

const INITIAL_INVITE_STATE: InviteState = {
    error: null,
    success: null,
    inviteToken: null,
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function roleLabel(role: string): string {
    switch (role) {
        case 'TENANT_ADMIN':
            return 'Tenant-Admin'
        case 'EDITOR':
            return 'Redakteur'
        case 'SUBSCRIBER':
            return 'Abonnent'
        case 'GUEST':
            return 'Gast'
        default:
            return role
    }
}

function statusLabel(status: string): string {
    switch (status) {
        case 'ACTIVE':
            return 'Aktiv'
        case 'INVITED':
            return 'Eingeladen'
        case 'DISABLED':
            return 'Deaktiviert'
        default:
            return status
    }
}

/**
 * Team list with invite + deactivate/reactivate for TENANT_ADMIN.
 */
export default function TeamClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const me = useMe()
    const [users, setUsers] = useState<TenantUser[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [actionError, setActionError] = useState<string | null>(null)
    const [busyUserId, setBusyUserId] = useState<number | null>(null)

    const reload = useCallback(async (): Promise<void> => {
        const result = await listTenantUsers(getClientTenantHost())
        setUsers(result)
    }, [])

    useEffect(() => {
        let active = true

        reload()
            .then(() => {
                if (!active) {
                    return
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Team konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [reload, router])

    async function inviteAction(
        _previous: InviteState,
        formData: FormData,
    ): Promise<InviteState> {
        const email = String(formData.get('email') ?? '').trim().toLowerCase()
        const name = String(formData.get('name') ?? '').trim()
        const role = String(formData.get('role') ?? '').trim() as TenantInvitableRole

        if (!EMAIL_PATTERN.test(email) || email.length > 254) {
            return {...INITIAL_INVITE_STATE, error: 'Bitte eine gültige E-Mail eingeben.'}
        }
        if (!(TENANT_INVITABLE_ROLES as readonly string[]).includes(role)) {
            return {...INITIAL_INVITE_STATE, error: 'Bitte eine Rolle wählen.'}
        }

        try {
            const response = await inviteTenantUser(getClientTenantHost(), {
                email,
                ...(name.length > 0 ? {name} : {}),
                role,
            })
            await reload()
            return {
                error: null,
                success: `Einladung an ${response.email} als ${roleLabel(response.role)} gesendet.`,
                inviteToken: response.inviteToken,
            }
        } catch (error: unknown) {
            if (authRedirect(error)) return INITIAL_INVITE_STATE
            return {
                ...INITIAL_INVITE_STATE,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Einladung fehlgeschlagen.',
            }
        }
    }

    const [inviteState, inviteFormAction, invitePending] = useActionState(
        inviteAction,
        INITIAL_INVITE_STATE,
    )

    async function toggleMembership(user: TenantUser): Promise<void> {
        setBusyUserId(user.userId)
        setActionError(null)
        try {
            if (user.status === 'DISABLED') {
                await reactivateTenantUser(getClientTenantHost(), user.userId)
            } else {
                await deactivateTenantUser(getClientTenantHost(), user.userId)
            }
            await reload()
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setActionError(
                error instanceof Error
                    ? error.message
                    : 'Mitgliedschaft konnte nicht geändert werden.',
            )
        } finally {
            setBusyUserId(null)
        }
    }

    if (isLoading) {
        return <p className="text-sm text-muted-foreground">Wird geladen…</p>
    }

    if (loadError !== null) {
        return (
            <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
            </Alert>
        )
    }

    return (
        <PageStack>
            <PageHeader
                description="Lade Redakteure und weitere Mandanten-Admins ein. Abonnenten verwaltest du unter Zahlungen."
                eyebrow="Team"
                title="Mitglieder"
            />

            {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Mitglieder.</p>
            ) : (
                <ListPanel>
                    {users.map((user) => {
                        const isSelf = user.email === me.email
                        return (
                            <ListPanelRow key={user.userId}>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">{user.name ?? user.email}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {user.email}
                                        {' · '}
                                        {user.roles.map(roleLabel).join(', ')}
                                        {' · '}
                                        {statusLabel(user.status)}
                                    </p>
                                </div>
                                {!isSelf ? (
                                    <Button
                                        disabled={busyUserId === user.userId}
                                        onClick={() => {
                                            void toggleMembership(user)
                                        }}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        {user.status === 'DISABLED'
                                            ? 'Reaktivieren'
                                            : 'Deaktivieren'}
                                    </Button>
                                ) : null}
                            </ListPanelRow>
                        )
                    })}
                </ListPanel>
            )}

            {actionError ? (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            ) : null}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Person einladen</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form action={inviteFormAction} className="grid gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="invite-email">E-Mail</Label>
                            <Input
                                autoComplete="email"
                                id="invite-email"
                                maxLength={254}
                                name="email"
                                required
                                type="email"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="invite-name">Name</Label>
                            <Input
                                autoComplete="name"
                                id="invite-name"
                                maxLength={200}
                                name="name"
                                type="text"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="invite-role">Rolle</Label>
                            <SelectControl
                                defaultValue="EDITOR"
                                id="invite-role"
                                name="role"
                                required
                            >
                                {TENANT_INVITABLE_ROLES.map((role) => (
                                    <option key={role} value={role}>
                                        {roleLabel(role)}
                                    </option>
                                ))}
                            </SelectControl>
                        </div>
                        {inviteState.error ? (
                            <Alert variant="destructive">
                                <AlertDescription>{inviteState.error}</AlertDescription>
                            </Alert>
                        ) : null}
                        {inviteState.success ? (
                            <Alert>
                                <AlertDescription>{inviteState.success}</AlertDescription>
                            </Alert>
                        ) : null}
                        {inviteState.inviteToken ? (
                            <div className="grid gap-2">
                                <Label htmlFor="invite-token">Dev-Einladungs-Token</Label>
                                <Input
                                    id="invite-token"
                                    readOnly
                                    type="text"
                                    value={inviteState.inviteToken}
                                />
                            </div>
                        ) : null}
                        <Button disabled={invitePending} type="submit">
                            {invitePending ? 'Einladen…' : 'Einladung senden'}
                        </Button>
                    </Form>
                </CardContent>
            </Card>
        </PageStack>
    )
}
