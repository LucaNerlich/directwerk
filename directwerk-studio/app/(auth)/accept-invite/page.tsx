'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Suspense, useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import {acceptInvite} from '@/lib/api/authApi'
import {parseAcceptInviteInput} from '@directwerk/api/validation/input'

interface AcceptInviteState {
    error: string | null
    success: boolean
}

const INITIAL_STATE: AcceptInviteState = {error: null, success: false}

function AcceptInviteForm() {
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''

    const [state, formAction, isPending] = useActionState(
        async (_previousState: AcceptInviteState, formData: FormData) => {
            const input = parseAcceptInviteInput({
                token: formData.get('token'),
                password: formData.get('password'),
                name: formData.get('name') || undefined,
            })
            if (input === null) {
                return {
                    error:
                        'Bitte Einladungs-Token und Passwort (mind. 12 Zeichen) eingeben.',
                    success: false,
                }
            }

            try {
                await acceptInvite(input)
                window.location.assign('/login')
                return {error: null, success: true}
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Die Einladung konnte nicht angenommen werden.',
                    success: false,
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <div className="grid gap-4">
            {tokenFromQuery.length > 0 ? (
                <p className="text-sm text-muted-foreground" role="status">
                    Einladungs-Token übernommen — lege jetzt dein Passwort fest.
                </p>
            ) : null}
            <Form action={formAction} className="grid gap-4">
                {tokenFromQuery.length > 0 ? (
                    <input type="hidden" name="token" value={tokenFromQuery} />
                ) : (
                    <div className="grid gap-2">
                        <Label htmlFor="token">Einladungs-Token</Label>
                        <Input
                            autoComplete="off"
                            id="token"
                            maxLength={512}
                            name="token"
                            required
                            type="text"
                        />
                    </div>
                )}
                <div className="grid gap-2">
                    <Label htmlFor="name">
                        Name <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                        autoComplete="name"
                        id="name"
                        maxLength={255}
                        name="name"
                        type="text"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">Passwort</Label>
                    <Input
                        autoComplete="new-password"
                        id="password"
                        maxLength={128}
                        minLength={12}
                        name="password"
                        required
                        type="password"
                    />
                </div>
                <Button className="w-full" disabled={isPending || state.success} type="submit">
                    {isPending ? 'Wird angenommen…' : 'Einladung annehmen'}
                </Button>
            </Form>
            {state.error !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            ) : null}
            {state.success ? (
                <Alert role="status">
                    <AlertDescription>Einladung angenommen. Weiterleitung…</AlertDescription>
                </Alert>
            ) : null}
        </div>
    )
}

export default function AcceptInvitePage() {
    return (
        <AuthCard
            description="Lege dein Passwort fest, um dem Workspace beizutreten."
            footer={
                <Link className="underline" href="/login">
                    Zur Anmeldung
                </Link>
            }
            title="Einladung annehmen"
        >
            <Suspense
                fallback={
                    <div
                        aria-busy="true"
                        aria-live="polite"
                        className="grid gap-4"
                        role="status"
                    >
                        <span className="sr-only">Einladungsformular wird geladen…</span>
                        <Skeleton className="h-10 w-full" aria-hidden="true" />
                        <Skeleton className="h-10 w-full" aria-hidden="true" />
                        <Skeleton className="h-10 w-full" aria-hidden="true" />
                    </div>
                }
            >
                <AcceptInviteForm />
            </Suspense>
        </AuthCard>
    )
}
