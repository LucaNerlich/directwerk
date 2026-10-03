'use client'

import Form from 'next/form'
import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
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
import WorkspaceChooser from '@/components/studio/WorkspaceChooser'
import {clearAllCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'
import {parseLoginInput} from '@directwerk/api/validation/input'
import type {StudioWorkspace} from '@directwerk/api/types'

import {setTokens} from '@/lib/auth/tokenStore'
import {invalidatePendingRefresh} from '@/lib/auth/session'
import {getClientTenantHost} from '@directwerk/api/tenant'

interface LoginState {
    error: string | null
}

const INITIAL_STATE: LoginState = {error: null}

function AuthFormSkeleton(): React.JSX.Element {
    const dict = useDictionary()
    return (
        <div aria-busy="true" aria-live="polite" className="grid gap-4" role="status">
            <span className="sr-only">{dict.auth.loginFormLoading}</span>
            <Skeleton className="h-10 w-full" aria-hidden="true" />
            <Skeleton className="h-10 w-full" aria-hidden="true" />
            <Skeleton className="h-10 w-full" aria-hidden="true" />
        </div>
    )
}

function mapAuthError(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) {
        return fallback
    }

    return error.message.length > 0 ? error.message : fallback
}

async function completeLogin(
    workspace: StudioWorkspace,
    input: {email: string; password: string},
    workspaceSaveFailedMessage: string,
): Promise<void> {
    await selectTenantHost(workspace.host)
    if (getClientTenantHost() !== workspace.host) {
        throw new Error(workspaceSaveFailedMessage)
    }

    const tokens = await login(workspace.host, input)
    invalidatePendingRefresh()
    clearAllCachedTenantData()
    setTokens(tokens)
}

function LoginForm() {
    const searchParams = useSearchParams()
    const localize = useLocalizedPath()
    const dict = useDictionary()
    const roleDenied = searchParams.get('reason') === 'role'
    const workspaceMissing = searchParams.get('reason') === 'workspace'
    const [workspaces, setWorkspaces] = useState<StudioWorkspace[] | null>(null)
    const [pendingInput, setPendingInput] = useState<{
        email: string
        password: string
    } | null>(null)
    const [workspaceError, setWorkspaceError] = useState<string | null>(null)
    const [openingWorkspaceHost, setOpeningWorkspaceHost] = useState<string | null>(null)
    const isOpeningWorkspace = openingWorkspaceHost !== null
    const [state, formAction, isPending] = useActionState(
        async (_previousState: LoginState, formData: FormData) => {
            const input = parseLoginInput({
                email: formData.get('email'),
                password: formData.get('password'),
            })
            if (input === null) {
                return {
                    error: dict.auth.emailPasswordRequired,
                }
            }

            try {
                const discovered = await discoverStudioWorkspaces(input)
                if (discovered.length === 1) {
                    await completeLogin(
                        discovered[0]!,
                        input,
                        dict.auth.workspaceSaveFailedCookies,
                    )
                    window.location.assign(localize('/'))
                    return INITIAL_STATE
                }
                if (discovered.length === 0) {
                    return {
                        error: dict.auth.noWorkspaceFound,
                    }
                }

                setPendingInput(input)
                setWorkspaces(discovered)
                return INITIAL_STATE
            } catch (error) {
                return {error: mapAuthError(error, dict.auth.loginFailed)}
            }
        },
        INITIAL_STATE,
    )

    async function openWorkspace(workspace: StudioWorkspace): Promise<void> {
        if (pendingInput === null) {
            return
        }

        setWorkspaceError(null)
        setOpeningWorkspaceHost(workspace.host)
        try {
            await completeLogin(workspace, pendingInput, dict.auth.workspaceSaveFailedCookies)
            window.location.assign(localize('/'))
        } catch (error) {
            setWorkspaceError(mapAuthError(error, dict.auth.loginFailed))
        } finally {
            setOpeningWorkspaceHost(null)
        }
    }

    if (workspaces !== null && pendingInput !== null) {
        return (
            <AuthCard
                description={dict.auth.step2ChooseWorkspace}
                title={dict.auth.selectWorkspace}
            >
                <div aria-busy={isOpeningWorkspace}>
                    <WorkspaceChooser
                        error={workspaceError}
                        onBack={() => {
                            setWorkspaces(null)
                            setPendingInput(null)
                            setWorkspaceError(null)
                        }}
                        onSelect={(workspace) => {
                            void openWorkspace(workspace)
                        }}
                        openingHost={openingWorkspaceHost}
                        workspaces={workspaces}
                    />
                </div>
            </AuthCard>
        )
    }

    return (
        <AuthCard
            description={dict.auth.step1SignIn}
            footer={
                <span>
                    {dict.auth.inviteReceived}{' '}
                    <LocaleLink className="underline" href="/accept-invite">
                        {dict.auth.acceptInvite}
                    </LocaleLink>
                    {' · '}
                    <LocaleLink className="underline" href="/imprint">
                        {dict.auth.imprint}
                    </LocaleLink>
                    {' · '}
                    <LocaleLink className="underline" href="/privacy">
                        {dict.auth.privacy}
                    </LocaleLink>
                </span>
            }
            title={dict.auth.signInStudio}
        >
            {roleDenied ? (
                <Alert variant="destructive">
                    <AlertDescription>{dict.auth.studioEditorsOnly}</AlertDescription>
                </Alert>
            ) : null}
            {workspaceMissing ? (
                <Alert variant="destructive">
                    <AlertDescription>{dict.auth.workspaceUnavailable}</AlertDescription>
                </Alert>
            ) : null}
            <Form action={formAction} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="login-email">{dict.auth.email}</Label>
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
                    <Label htmlFor="login-password">{dict.auth.password}</Label>
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
                    {isPending ? dict.auth.signingIn : dict.auth.continue}
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

function LoginFallback(): React.JSX.Element {
    const dict = useDictionary()
    return (
        <AuthCard
            description={dict.auth.loginFormPreparing}
            title={dict.auth.signInStudio}
        >
            <AuthFormSkeleton />
        </AuthCard>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginForm />
        </Suspense>
    )
}
