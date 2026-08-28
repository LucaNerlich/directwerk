'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
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

import {getPlatformAuditLog} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PlatformAuditEvent} from '@directwerk/api/types'

function formatTimestamp(value: string): string {
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
        return value
    }
    return new Date(parsed).toLocaleString()
}

function formatDetails(details: Record<string, unknown>): string {
    try {
        return JSON.stringify(details)
    } catch {
        return String(details)
    }
}

export default function AuditPage() {
    const router = useRouter()
    const [events, setEvents] = useState<PlatformAuditEvent[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true

        getPlatformAuditLog(50)
            .then((result) => {
                if (active) {
                    setEvents(result)
                    setError(null)
                    setIsLoading(false)
                }
            })
            .catch((requestError: unknown) => {
                if (!active) {
                    return
                }
                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }
                setEvents([])
                setError('Could not load audit log.')
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [router])

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Platform"
                title="Audit log"
                description="Recent platform-admin actions (newest first)."
            />

            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            {isLoading ? (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                    Loading audit events…
                </p>
            ) : null}

            {!isLoading && error === null ? (
                events.length === 0 ? (
                    <EmptyState
                        description="Platform actions will appear here once recorded."
                        title="No audit events yet"
                    />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">When</TableHead>
                                <TableHead scope="col">Action</TableHead>
                                <TableHead scope="col">Actor</TableHead>
                                <TableHead scope="col">Tenant</TableHead>
                                <TableHead scope="col">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map((event) => (
                                <TableRow key={event.id}>
                                    <TableCell className="whitespace-nowrap text-sm">
                                        {formatTimestamp(event.createdAt)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{event.action}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {event.actorUserId ?? '—'}
                                    </TableCell>
                                    <TableCell>
                                        {event.tenantId !== null ? (
                                            <Link
                                                className="underline-offset-4 hover:underline"
                                                href={`/tenants/${event.tenantId}`}
                                            >
                                                {event.tenantId}
                                            </Link>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                                        {formatDetails(event.details)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
            ) : null}
        </div>
    )
}
