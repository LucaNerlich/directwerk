'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'

import {Badge} from '@directwerk/ui/components/badge'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import type {Tenant} from '@directwerk/api/types'

function formatTimestamp(value: string | undefined): string {
    if (!value) {
        return '—'
    }

    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
        return value
    }

    return new Date(parsed).toLocaleDateString()
}

interface TenantListTableProps {
    tenants: Tenant[]
    showFilters?: boolean
}

export default function TenantListTable({
    tenants,
    showFilters = true,
}: TenantListTableProps): React.JSX.Element {
    const [query, setQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>(
        'ALL',
    )

    const filteredTenants = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()

        return tenants.filter((tenant) => {
            if (statusFilter !== 'ALL' && tenant.status !== statusFilter) {
                return false
            }

            if (normalizedQuery.length === 0) {
                return true
            }

            return (
                tenant.name.toLowerCase().includes(normalizedQuery) ||
                tenant.slug.toLowerCase().includes(normalizedQuery) ||
                (tenant.primaryDomain ?? '').toLowerCase().includes(normalizedQuery)
            )
        })
    }, [query, statusFilter, tenants])

    return (
        <div className="space-y-4">
            {showFilters ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="tenant-search">Search</Label>
                        <Input
                            id="tenant-search"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Name, slug, or domain"
                            type="search"
                            value={query}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tenant-status-filter">Status</Label>
                        <select
                            className="native-select"
                            id="tenant-status-filter"
                            onChange={(event) =>
                                setStatusFilter(
                                    event.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED',
                                )
                            }
                            value={statusFilter}
                        >
                            <option value="ALL">All statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="SUSPENDED">Suspended</option>
                        </select>
                    </div>
                </div>
            ) : null}

            <ResponsiveTable label="Tenants">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead scope="col">Name</TableHead>
                            <TableHead scope="col">Slug</TableHead>
                            <TableHead scope="col">Primary domain</TableHead>
                            <TableHead scope="col">Created</TableHead>
                            <TableHead scope="col">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTenants.map((tenant) => (
                            <TableRow key={tenant.id}>
                                <TableCell>
                                    <Link
                                        className="font-medium underline-offset-4 hover:underline"
                                        href={`/tenants/${tenant.id}`}
                                    >
                                        {tenant.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{tenant.slug}</TableCell>
                                <TableCell>{tenant.primaryDomain ?? '—'}</TableCell>
                                <TableCell>{formatTimestamp(tenant.createdAt)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">{tenant.status}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ResponsiveTable>
        </div>
    )
}
