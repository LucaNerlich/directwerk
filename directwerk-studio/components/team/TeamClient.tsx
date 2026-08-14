'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useCallback, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@/lib/api/errors'
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
} from '@/lib/api/types'
import {useMe} from '@/lib/auth/MeProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
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
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return INITIAL_INVITE_STATE
            }
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
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return
            }
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
        return <p>Wird geladen…</p>
    }

    if (loadError !== null) {
        return <p className="text-sm text-destructive">{loadError}</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Team</p>
                    <h1>Mitglieder</h1>
                </div>
            </header>

            {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Mitglieder.</p>
            ) : (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                    {users.map((user) => {
                        const isSelf = user.email === me.email
                        return (
                            <li key={user.userId}>
                                <div>
                                    <strong>{user.name ?? user.email}</strong>
                                    <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                        {user.email}
                                        {' · '}
                                        {user.roles.map(roleLabel).join(', ')}
                                        {' · '}
                                        {statusLabel(user.status)}
                                    </span>
                                </div>
                                {!isSelf ? (
                                    <Button
                                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                                        disabled={busyUserId === user.userId}
                                        onClick={() => {
                                            void toggleMembership(user)
                                        }}
                                        type="button"
                                    >
                                        {user.status === 'DISABLED'
                                            ? 'Reaktivieren'
                                            : 'Deaktivieren'}
                                    </Button>
                                ) : null}
                            </li>
                        )
                    })}
                </ul>
            )}

            {actionError ? (
                <p aria-live="polite" className="text-sm text-destructive" role="alert">
                    {actionError}
                </p>
            ) : null}

            <Form action={inviteFormAction} className="grid w-full max-w-xl gap-5">
                <h2>Person einladen</h2>
                <label className="grid gap-2 text-sm font-medium" htmlFor="invite-email">
                    E-Mail
                    <Input
                        autoComplete="email"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        id="invite-email"
                        maxLength={254}
                        name="email"
                        required
                        type="email"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="invite-name">
                    Name
                    <Input
                        autoComplete="name"
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        id="invite-name"
                        maxLength={200}
                        name="name"
                        type="text"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="invite-role">
                    Rolle
                    <SelectControl
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
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
                </label>
                {inviteState.error ? (
                    <p aria-live="polite" className="text-sm text-destructive" role="alert">
                        {inviteState.error}
                    </p>
                ) : null}
                {inviteState.success ? (
                    <p aria-live="polite" role="status">
                        {inviteState.success}
                    </p>
                ) : null}
                {inviteState.inviteToken ? (
                    <label className="grid gap-2 text-sm font-medium" htmlFor="invite-token">
                        Dev-Einladungs-Token
                        <Input
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            id="invite-token"
                            readOnly
                            type="text"
                            value={inviteState.inviteToken}
                        />
                    </label>
                ) : null}
                <Button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50" disabled={invitePending} type="submit">
                    {invitePending ? 'Einladen…' : 'Einladung senden'}
                </Button>
            </Form>
        </div>
    )
}
