'use client'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import InvitePlatformAdminForm from '@/components/InvitePlatformAdminForm'
import RevokeAdminButton from '@/components/RevokeAdminButton'
import {getPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PlatformAdmin} from '@/lib/api/types'

/**
 * Displays platform administrators and provides controls to invite or revoke administrators.
 */
export default function PlatformAdminsPage() {
    const router = useRouter()
    const [admins, setAdmins] = useState<PlatformAdmin[] | null>(null)
    const [error, setError] = useState<string | null>(null)

    const loadAdmins = useCallback(() => {
        setError(null)

        getPlatformData<PlatformAdmin[]>('admins')
            .then((result) => {
                setAdmins(result)
            })
            .catch((requestError: unknown) => {
                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }

                setError('Could not load platform admins.')
            })
    }, [router])

    useEffect(() => {
        loadAdmins()
    }, [loadAdmins])

    return (
        <div className="space-y-8">
            <PageHeader
                description="Invite administrators and revoke platform-level access."
                eyebrow="Access control"
                title="Platform admins"
            />
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            {!error && admins === null ? (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                    Loading platform admins…
                </p>
            ) : null}
            {admins ? (
                <>
                    {admins.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Name</TableHead>
                                    <TableHead scope="col">Email</TableHead>
                                    <TableHead scope="col">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {admins.map((admin) => (
                                    <TableRow key={admin.userId}>
                                        <TableCell>{admin.name ?? '—'}</TableCell>
                                        <TableCell>{admin.email}</TableCell>
                                        <TableCell>
                                            <RevokeAdminButton onRevoked={loadAdmins} userId={admin.userId} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <EmptyState title="No platform admins" />
                    )}
                    <InvitePlatformAdminForm onInvited={loadAdmins} />
                </>
            ) : null}
        </div>
    )
}
