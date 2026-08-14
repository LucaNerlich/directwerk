'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {resetPassword} from '@/lib/api/client'
import {parseResetPasswordInput} from '@/lib/api/validation'

interface ResetPasswordState {
    error: string | null
    success: boolean
}

const INITIAL_STATE: ResetPasswordState = {error: null, success: false}

function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''

    const [state, formAction, isPending] = useActionState(
        async (_previousState: ResetPasswordState, formData: FormData) => {
            const input = parseResetPasswordInput({
                token: formData.get('token'),
                newPassword: formData.get('newPassword'),
            })
            if (input === null) {
                return {
                    error:
                        'Enter the reset token and a new password of at least 12 characters.',
                    success: false,
                }
            }

            try {
                await resetPassword(input)
                router.push('/login')
                return {error: null, success: true}
            } catch (error) {
                return {
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Could not reset the password. Please try again.',
                    success: false,
                }
            }
        },
        INITIAL_STATE,
    )

    return (
        <>
            <Form action={formAction} className="space-y-4">
                {tokenFromQuery.length > 0 ? (
                    <input type="hidden" name="token" value={tokenFromQuery} />
                ) : (
                    <div className="space-y-2"><Label htmlFor="token">Reset token</Label><Input id="token" name="token" type="text" autoComplete="off" maxLength={512} required /></div>
                )}
                <div className="space-y-2"><Label htmlFor="newPassword">New password</Label><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></div>
                <Button className="w-full" type="submit" disabled={isPending || state.success}>
                    {isPending ? 'Saving…' : 'Set new password'}
                </Button>
            </Form>
            {state.error !== null ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            {state.success && (
                <Alert role="status"><AlertDescription>Password updated. Redirecting to login…</AlertDescription></Alert>
            )}
        </>
    )
}

export default function ResetPasswordPage() {
    return (
        <AuthCard title="Reset password" footer={<><Link className="underline" href="/login">Back to login</Link><span> · </span><Link className="underline" href="/forgot-password">Request a new link</Link></>}>
            <Suspense fallback={<p>Loading…</p>}>
                <ResetPasswordForm />
            </Suspense>
        </AuthCard>
    )
}
