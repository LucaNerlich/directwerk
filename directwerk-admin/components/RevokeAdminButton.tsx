'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'

import {deletePlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, FORBIDDEN} from '@/lib/api/errors'

interface RevokeAdminButtonProps {
    userId: number
    onRevoked: () => void
}

/**
 * Renders a button for revoking an administrator's access.
 *
 * @param userId - Identifier of the administrator to revoke
 * @param onRevoked - Callback invoked after the revocation succeeds
 */
export default function RevokeAdminButton({
    userId,
    onRevoked,
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
            <Button disabled={isRevoking} onClick={() => void handleRevoke()} type="button" variant="destructive">
                {isRevoking ? 'Revoking…' : 'Revoke'}
            </Button>
            {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        </>
    )
}
