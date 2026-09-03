'use client'

import Link from 'next/link'
import {useMemo, useState} from 'react'

import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

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
    const {viewMode, setViewMode} = useListViewMode()
    const hasActiveFilters = query.trim().length > 0 || statusFilter !== 'ALL'

    function clearFilters(): void {
        setQuery('')
        setStatusFilter('ALL')
    }

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

    const tenantItems: EntityListViewItem[] = filteredTenants.map((tenant) => ({
        id: tenant.id,
        title: tenant.name,
        href: `/tenants/${tenant.id}`,
        descriptions: [
            `Slug: ${tenant.slug}`,
            `Primary domain: ${tenant.primaryDomain ?? '—'}`,
            `Created: ${formatTimestamp(tenant.createdAt)}`,
        ],
        trailing: <Badge variant="outline">{tenant.status}</Badge>,
    }))

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

            {tenantItems.length > 0 ? (
                <EntityListSection
                    ariaLabel="Tenants"
                    items={tenantItems}
                    linkComponent={Link}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewGridLabel="Grid"
                    viewListLabel="List"
                    viewMode={viewMode}
                    viewToggleLabel="Change view"
                />
            ) : (
                <EmptyState
                    action={
                        hasActiveFilters ? (
                            <Button onClick={clearFilters} type="button" variant="outline">
                                Clear filters
                            </Button>
                        ) : undefined
                    }
                    description={
                        hasActiveFilters
                            ? 'Try a different search term or status.'
                            : 'Create the first tenant to begin.'
                    }
                    title="No tenants match your filters."
                />
            )}
        </div>
    )
}
