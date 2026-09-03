'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Suspense, useActionState, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import {
    discoverStudioWorkspaces,
    login,
    selectTenantHost,
} from '@/lib/api/authApi'
import {parseLoginInput} from '@directwerk/api/validation/input'
import type {StudioWorkspace} from '@directwerk/api/types'

import {setTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@directwerk/api/tenant'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

function AuthFormSkeleton(): React.JSX.Element {
    return (
        <div aria-busy="true" aria-live="polite" className="grid gap-4" role="status">
            <span className="sr-only">Anmeldeformular wird geladen…</span>
            <Skeleton className="h-10 w-full" aria-hidden="true" />
            <Skeleton className="h-10 w-full" aria-hidden="true" />
            <Skeleton className="h-10 w-full" aria-hidden="true" />
        </div>
    )
}

function mapAuthError(error: unknown): string {
    if (!(error instanceof Error)) {
        return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
    }

    return error.message.length > 0
        ? error.message
        : 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.'
}

async function completeLogin(
    workspace: StudioWorkspace,
    input: {email: string; password: string},
): Promise<void> {
    await selectTenantHost(workspace.host)
    if (getClientTenantHost() !== workspace.host) {
        throw new Error(
            'Der Workspace konnte nicht gespeichert werden. Bitte Browser-Cookies prüfen.',
        )
    }

    const tokens = await login(workspace.host, input)
    setTokens(tokens)
}

function enterStudio(): void {
    window.location.assign('/')
}

function LoginForm() {
    const searchParams = useSearchParams()
    const roleDenied = searchParams.get('reason') === 'role'
    const workspaceMissing = searchParams.get('reason') === 'workspace'
    const [workspaces, setWorkspaces] = useState<StudioWorkspace[] | null>(null)
    const [pendingInput, setPendingInput] = useState<{
        email: string
        password: string
    } | null>(null)
    const [workspaceError, setWorkspaceError] = useState<string | null>(null)
    const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false)
    const [state, formAction, isPending] = useActionState(
        async (_previousState: LoginState, formData: FormData) => {
            const input = parseLoginInput({
                email: formData.get('email'),
                password: formData.get('password'),
            })
            if (input === null) {
                return {
                    error: 'Bitte gültige E-Mail und Passwort (mind. 12 Zeichen) eingeben.',
                }
            }

            try {
                const discovered = await discoverStudioWorkspaces(input)
                if (discovered.length === 1) {
                    await completeLogin(discovered[0]!, input)
                    enterStudio()
                    return INITIAL_STATE
                }

                setPendingInput(input)
                setWorkspaces(discovered)
                return INITIAL_STATE
            } catch (error) {
                return {error: mapAuthError(error)}
            }
        },
        INITIAL_STATE,
    )

    async function openWorkspace(workspace: StudioWorkspace): Promise<void> {
        if (pendingInput === null) {
            return
        }

        setWorkspaceError(null)
        setIsOpeningWorkspace(true)
        try {
            await completeLogin(workspace, pendingInput)
            enterStudio()
        } catch (error) {
            setWorkspaceError(mapAuthError(error))
        } finally {
            setIsOpeningWorkspace(false)
        }
    }

    if (workspaces !== null && pendingInput !== null) {
        return (
            <AuthCard
                description="Schritt 2 von 2 — wähle den Workspace, den du verwalten möchtest."
                title="Workspace auswählen"
            >
                <div aria-busy={isOpeningWorkspace} className="grid gap-2">
                    {workspaces.map((workspace) => (
                        <Button
                            aria-label={`${workspace.name} (${workspace.host}) öffnen`}
                            disabled={isOpeningWorkspace}
                            key={workspace.tenantId}
                            onClick={() => {
                                void openWorkspace(workspace)
                            }}
                            type="button"
                            variant="outline"
                        >
                            <span className="flex flex-col items-start gap-0.5 text-left">
                                <span className="font-medium">{workspace.name}</span>
                                <span className="text-xs text-muted-foreground">
                                    {workspace.host}
                                </span>
                            </span>
                        </Button>
                    ))}
                </div>
                {workspaceError !== null ? (
                    <Alert variant="destructive">
                        <AlertDescription>{workspaceError}</AlertDescription>
                    </Alert>
                ) : null}
                <Button
                    disabled={isOpeningWorkspace}
                    onClick={() => {
                        setWorkspaces(null)
                        setPendingInput(null)
                        setWorkspaceError(null)
                    }}
                    type="button"
                    variant="ghost"
                >
                    Zurück
                </Button>
            </AuthCard>
        )
    }

    return (
        <AuthCard
            description="Schritt 1 von 2 — melde dich an, um Inhalte für deinen Mandanten zu verwalten."
            footer={
                <span>
                    Einladung erhalten?{' '}
                    <Link className="underline" href="/accept-invite">
                        Einladung annehmen
                    </Link>
                </span>
            }
            title="Studio anmelden"
        >
            {roleDenied ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        Studio ist nur für Editoren und Mandanten-Admins verfügbar.
                    </AlertDescription>
                </Alert>
            ) : null}
            {workspaceMissing ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        Der gewählte Workspace ist nicht mehr verfügbar. Bitte erneut
                        anmelden.
                    </AlertDescription>
                </Alert>
            ) : null}
            <Form action={formAction} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="login-email">E-Mail</Label>
                    <Input
                        autoComplete="username"
                        id="login-email"
                        inputMode="email"
                        maxLength={254}
                        name="email"
                        required
                        type="email"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <Input
                        autoComplete="current-password"
                        id="login-password"
                        maxLength={128}
                        minLength={12}
                        name="password"
                        required
                        type="password"
                    />
                </div>
                <Button className="w-full" disabled={isPending} type="submit">
                    {isPending ? 'Anmeldung…' : 'Weiter'}
                </Button>
            </Form>
            {state.error !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            ) : null}
        </AuthCard>
    )
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <AuthCard
                    description="Das Anmeldeformular wird vorbereitet."
                    title="Studio anmelden"
                >
                    <AuthFormSkeleton />
                </AuthCard>
            }
        >
            <LoginForm />
        </Suspense>
    )
}
