'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import {AdminLoadingText, TableSkeleton} from '@/components/AdminLoading'
import CreateTenantForm from '@/components/CreateTenantForm'
import TenantListTable from '@/components/TenantListTable'
import {getPlatformTenantsPage} from '@/lib/api/client'
import {usePlatformQuery} from '@/lib/api/usePlatformQuery'

const PAGE_SIZE = 25

export default function TenantsPage(): React.JSX.Element {
    const [page, setPage] = useState(0)
    const {
        data: tenantsPage,
        error,
        isLoading,
        reload: reloadTenants,
    } = usePlatformQuery(() => getPlatformTenantsPage(page, PAGE_SIZE), {
        fallbackError: 'Could not load tenants.',
        queryKey: String(page),
    })

    const tenants = tenantsPage?.content ?? null
    const hasPreviousPage = tenantsPage !== null && tenantsPage.page > 0
    const hasNextPage =
        tenantsPage !== null && (tenantsPage.page + 1) * tenantsPage.size < tenantsPage.totalElements

    return (
        <PageStack>
            <PageHeader
                description="Search, filter, and open tenant records."
                eyebrow="Platform administration"
                title="Tenants"
            />

            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {error ? (
                <div>
                    <Button onClick={reloadTenants} type="button" variant="outline">
                        Retry
                    </Button>
                </div>
            ) : null}

            {!error && tenants === null ? (
                <>
                    <TableSkeleton rows={6} />
                    <AdminLoadingText text="Loading tenants…" />
                </>
            ) : null}

            {tenants ? (
                <>
                    {tenants.length > 0 ? (
                        <TenantListTable tenants={tenants} />
                    ) : (
                        <EmptyState
                            description="Create the first tenant to begin."
                            title="No tenants yet"
                        />
                    )}
                    {!error && !isLoading && tenantsPage ? (
                        <>
                            <p aria-live="polite" className="text-sm text-muted-foreground">
                                Showing {tenantsPage.content.length} of {tenantsPage.totalElements}{' '}
                                tenants (page {tenantsPage.page + 1}, size {tenantsPage.size}).
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    aria-label="Previous tenant page"
                                    disabled={!hasPreviousPage}
                                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                                    type="button"
                                    variant="outline"
                                >
                                    Previous page
                                </Button>
                                <Button
                                    aria-label="Next tenant page"
                                    disabled={!hasNextPage}
                                    onClick={() => setPage((current) => current + 1)}
                                    type="button"
                                    variant="outline"
                                >
                                    Next page
                                </Button>
                            </div>
                        </>
                    ) : null}
                </>
            ) : null}

            <SectionHeader
                description="Creates the tenant record with an optional module preset. The first admin invitation is optional; omit admin email to create the tenant without one."
                title="Create tenant"
            />
            <CreateTenantForm onCreated={reloadTenants} />
        </PageStack>
    )
}
