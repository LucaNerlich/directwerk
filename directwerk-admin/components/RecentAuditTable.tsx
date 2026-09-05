'use client'

import {Badge} from '@directwerk/ui/components/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import {formatTimestamp} from '@directwerk/api/format/datetime'
import type {PlatformAuditEvent} from '@directwerk/api/types'

interface RecentAuditTableProps {
    events: PlatformAuditEvent[]
}

/**
 * Renders a table of recent platform audit events.
 *
 * @param events - The audit events to display
 * @returns The rendered audit event table
 */
export default function RecentAuditTable({
    events,
}: RecentAuditTableProps): React.JSX.Element {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col">When</TableHead>
                    <TableHead scope="col">Action</TableHead>
                    <TableHead scope="col">Actor</TableHead>
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
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
