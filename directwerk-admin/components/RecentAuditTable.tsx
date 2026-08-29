'use client'

import Link from 'next/link'

import {Badge} from '@directwerk/ui/components/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import type {PlatformAuditEvent} from '@directwerk/api/types'

function formatTimestamp(value: string): string {
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
        return value
    }
    return new Date(parsed).toLocaleString()
}

interface RecentAuditTableProps {
    events: PlatformAuditEvent[]
    compact?: boolean
}

export default function RecentAuditTable({
    events,
    compact = false,
}: RecentAuditTableProps): React.JSX.Element {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col">When</TableHead>
                    <TableHead scope="col">Action</TableHead>
                    <TableHead scope="col">Actor</TableHead>
                    {!compact ? <TableHead scope="col">Tenant</TableHead> : null}
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
                            {event.actorEmail ?? event.actorUserId ?? '—'}
                        </TableCell>
                        {!compact ? (
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
                        ) : null}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
