'use client'

import Link from 'next/link'
import {useEffect, useMemo, useState} from 'react'

import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {formatTimestamp} from '@directwerk/api/format/datetime'
import type {Tenant} from '@directwerk/api/types'
import {fuzzyFilter} from '@directwerk/ui/lib/fuzzy'

interface TenantListTableProps {
    tenants: Tenant[]
    showFilters?: boolean
    /**
     * Controlled search term. When `onQueryChange` is supplied the search runs server-side over
     * the whole estate (issue #551) and the table no longer filters the loaded page by text.
     */
    query?: string
    onQueryChange?: (query: string) => void
}

export default function TenantListTable({
    tenants,
    showFilters = true,
    query: controlledQuery,
    onQueryChange,
}: TenantListTableProps): React.JSX.Element {
    const serverSearch = onQueryChange !== undefined
    const [query, setQuery] = useState(controlledQuery ?? '')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>(
        'ALL',
    )
    const {viewMode, setViewMode} = useListViewMode()
    const hasActiveFilters = query.trim().length > 0 || statusFilter !== 'ALL'

    useEffect(() => {
        setQuery(controlledQuery ?? '')
    }, [controlledQuery])

    useEffect(() => {
        if (!serverSearch || query === (controlledQuery ?? '')) {
            return
        }
        const handle = setTimeout(() => onQueryChange?.(query), 300)
        return () => clearTimeout(handle)
    }, [controlledQuery, onQueryChange, query, serverSearch])

    function clearFilters(): void {
        setQuery('')
        setStatusFilter('ALL')
        if (serverSearch) {
            onQueryChange?.('')
        }
    }

    const filteredTenants = useMemo(() => {
        const byStatus =
            statusFilter === 'ALL'
                ? tenants
                : tenants.filter((tenant) => tenant.status === statusFilter)

        if (serverSearch) {
            return byStatus
        }

        return fuzzyFilter(byStatus, query, {
            keys: ['name', 'slug', 'primaryDomain'],
        })
    }, [query, serverSearch, statusFilter, tenants])

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
                        <Label htmlFor="tenant-search">
                            {serverSearch ? 'Search all tenants' : 'Search'}
                        </Label>
                        <Input
                            id="tenant-search"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Name, slug, or domain"
                            type="search"
                            value={query}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tenant-status-filter">
                            {serverSearch ? 'Status (this page)' : 'Status'}
                        </Label>
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
                    title={
                        hasActiveFilters
                            ? 'No tenants match your filters.'
                            : 'No tenants yet'
                    }
                />
            )}
        </div>
    )
}
