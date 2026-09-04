'use client'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import SelectControl from '@/components/studio/SelectControl'
import {deactivateTenantUser, inviteTenantUser, listTenantUsers, reactivateTenantUser} from '@/lib/api/tenantSettingsApi'
import {
    TENANT_INVITABLE_ROLES,
    type TenantInvitableRole,
    type TenantUser,
} from '@directwerk/api/types'
import {useMe} from '@/lib/auth/MeProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
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

function roleDescription(role: string): string {
    switch (role) {
        case 'TENANT_ADMIN':
            return 'Voller Zugriff — inkl. Einstellungen, Team und Zahlungen.'
        case 'EDITOR':
            return 'Erstellt und veröffentlicht Inhalte, keine Einstellungen.'
        case 'SUBSCRIBER':
            return 'Liest bezahlte Inhalte, kein Studio-Zugriff.'
        case 'GUEST':
            return 'Eingeschränkter Zugriff, nur Lesen.'
        default:
            return ''
    }
}

export default function TeamClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const me = useMe()
    const [users, setUsers] = useState<TenantUser[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [actionError, setActionError] = useState<string | null>(null)
    const [busyUserId, setBusyUserId] = useState<number | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const {viewMode, setViewMode} = useListViewMode()

    const reload = useCallback(async (): Promise<void> => {
        const result = await listTenantUsers(getClientTenantHost())
        setUsers(result)
    }, [])

    useEffect(() => {
        let active = true

        setIsLoading(true)
        setLoadError(null)
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
    }, [reload, reloadToken, router])

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
        return (
            <PageStack>
                <PageHeader
                    description="Lade Redakteure und weitere Mandanten-Admins ein. Abonnenten verwaltest du unter Zahlungen."
                    eyebrow="Team"
                    title="Mitglieder"
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-64 w-full max-w-xl" />
            </PageStack>
        )
    }

    if (loadError !== null) {
        return (
            <PageStack>
                <PageHeader
                    description="Lade Redakteure und weitere Mandanten-Admins ein. Abonnenten verwaltest du unter Zahlungen."
                    eyebrow="Team"
                    title="Mitglieder"
                />
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => setReloadToken((value) => value + 1)}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
            </PageStack>
        )
    }

    const memberItems: EntityListViewItem[] = users.map((user) => {
        const isSelf = user.email === me.email
        return {
            id: user.userId,
            title: `${user.name ?? user.email}${isSelf ? ' (Du)' : ''}`,
            description: `${user.email} · ${user.roles.map(roleLabel).join(', ')}`,
            trailing: (
                <Badge variant={user.status === 'ACTIVE' ? 'default' : user.status === 'DISABLED' ? 'outline' : 'secondary'}>
                    {statusLabel(user.status)}
                </Badge>
            ),
            actions:
                !isSelf ? (
                    <Button
                        disabled={busyUserId === user.userId}
                        onClick={() => {
                            void toggleMembership(user)
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {busyUserId === user.userId
                            ? 'Arbeiten…'
                            : user.status === 'DISABLED'
                              ? 'Reaktivieren'
                              : 'Deaktivieren'}
                    </Button>
                ) : undefined,
        }
    })

    return (
        <PageStack>
            <PageHeader
                description="Lade Redakteure und weitere Mandanten-Admins ein. Abonnenten verwaltest du unter Zahlungen — hier geht es nur um dein Team."
                eyebrow="Team"
                title="Mitglieder"
            />

            <section aria-labelledby="team-list-heading" className="flex flex-col gap-4">
                <SectionHeader
                    id="team-list-heading"
                    title={`Mitglieder (${users.length})`}
                    description="Deaktivierte Konten verlieren sofort den Zugriff; reaktivieren stellt ihn wieder her."
                />
            {users.length === 0 ? (
                <EmptyState
                    title="Noch keine Mitglieder"
                    description="Lade unten die erste Person ein — z. B. als Redakteur."
                />
            ) : (
                <EntityListSection
                    items={memberItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
            )}
            </section>

            {actionError ? (
                <Alert variant="destructive">
                    <AlertDescription>{actionError}</AlertDescription>
                </Alert>
            ) : null}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Person einladen</CardTitle>
                    <CardDescription>
                        Die Einladung gilt für diesen Mandanten. Neue Mitglieder erhalten eine E-Mail mit Aktivierungslink.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form action={inviteFormAction} className="grid gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="invite-email">E-Mail</Label>
                            <Input
                                aria-describedby="invite-email-help"
                                autoComplete="email"
                                id="invite-email"
                                maxLength={254}
                                name="email"
                                placeholder="name@beispiel.de"
                                required
                                type="email"
                            />
                            <p className="text-xs text-muted-foreground" id="invite-email-help">
                                An diese Adresse geht die Einladung. Bereits registrierte Konten werden direkt hinzugefügt.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="invite-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input
                                aria-describedby="invite-name-help"
                                autoComplete="name"
                                id="invite-name"
                                maxLength={200}
                                name="name"
                                placeholder="z. B. Alex Muster"
                                type="text"
                            />
                            <p className="text-xs text-muted-foreground" id="invite-name-help">
                                Wird im Team angezeigt. Leer lassen, um den Namen aus dem Konto zu übernehmen.
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="invite-role">Rolle</Label>
                            <SelectControl
                                aria-describedby="invite-role-help"
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
                            <ul className="grid gap-1 text-xs text-muted-foreground" id="invite-role-help">
                                {TENANT_INVITABLE_ROLES.map((role) => (
                                    <li key={role}>
                                        <span className="font-medium text-foreground">{roleLabel(role)}:</span>{' '}
                                        {roleDescription(role)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {inviteState.error ? (
                            <Alert variant="destructive">
                                <AlertDescription>{inviteState.error}</AlertDescription>
                            </Alert>
                        ) : null}
                        {inviteState.success ? (
                            <Alert role="status">
                                <AlertDescription>{inviteState.success}</AlertDescription>
                            </Alert>
                        ) : null}
                        {inviteState.inviteToken ? (
                            <div className="grid gap-2">
                                <Label htmlFor="invite-token">Dev-Einladungs-Token</Label>
                                <Input
                                    aria-describedby="invite-token-help"
                                    id="invite-token"
                                    readOnly
                                    type="text"
                                    value={inviteState.inviteToken}
                                />
                                <p className="text-xs text-muted-foreground" id="invite-token-help">
                                    Nur in Entwicklungsumgebungen sichtbar — im Produktivbetrieb erhält die Person eine E-Mail.
                                </p>
                            </div>
                        ) : null}
                        <div>
                        <Button disabled={invitePending} type="submit">
                            {invitePending ? 'Einladen…' : 'Einladung senden'}
                        </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </PageStack>
    )
}
