'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import {AdminLoadingText, TableSkeleton} from '@/components/AdminLoading'
import CreateTenantForm from '@/components/CreateTenantForm'
import TenantListTable from '@/components/TenantListTable'
import {getPlatformData} from '@/lib/api/client'
import {usePlatformQuery} from '@/lib/api/usePlatformQuery'
import type {TenantList} from '@directwerk/api/types'

export default function TenantsPage(): React.JSX.Element {
    const {data: tenants, error, reload: reloadTenants} = usePlatformQuery(
        () => getPlatformData<TenantList>('tenants').then((result) => result.content ?? []),
        {fallbackError: 'Could not load tenants.'},
    )

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
                tenants.length > 0 ? (
                    <TenantListTable tenants={tenants} />
                ) : (
                    <EmptyState
                        description="Create the first tenant to begin."
                        title="No tenants yet"
                    />
                )
            ) : null}

            <SectionHeader
                description="Creates the tenant record with an optional module preset. The first admin invitation is optional; omit admin email to create the tenant without one."
                title="Create tenant"
            />
            <CreateTenantForm onCreated={reloadTenants} />
        </PageStack>
    )
}
