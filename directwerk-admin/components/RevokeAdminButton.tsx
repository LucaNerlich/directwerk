'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import {deletePlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, FORBIDDEN} from '@directwerk/api/constants'

interface RevokeAdminButtonProps {
    userId: number
    onRevoked: () => void
    disabled?: boolean
    disabledReason?: string | null
}

export default function RevokeAdminButton({
    userId,
    onRevoked,
    disabled = false,
    disabledReason = null,
}: RevokeAdminButtonProps) {
    const [isRevoking, setIsRevoking] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleRevoke(): Promise<void> {
        const confirmed = window.confirm(
            'Revoke platform admin access for this user? This cannot be undone.',
        )
        if (!confirmed) {
            return
        }

        setIsRevoking(true)
        setError(null)

        try {
            await deletePlatformData(`admins/${userId}`)
            onRevoked()
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                setError('Your session expired. Sign in again.')
                return
            }
            if (
                requestError instanceof Error &&
                requestError.message === FORBIDDEN
            ) {
                setError('You do not have permission for this action.')
                return
            }
            setError(
                'Revoke failed. You may be revoking yourself or the last admin.'
            )
        } finally {
            setIsRevoking(false)
        }
    }

    return (
        <>
            <Button disabled={isRevoking || disabled} onClick={() => void handleRevoke()} title={disabledReason ?? undefined} type="button" variant="destructive">
                {isRevoking ? 'Revoking…' : 'Revoke'}
            </Button>
            {disabled && disabledReason ? <p className="text-xs text-muted-foreground">{disabledReason}</p> : null}
            {error ? <Alert aria-live="polite" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </>
    )
}
