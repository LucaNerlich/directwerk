'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import SectionHeader from '@directwerk/ui/components/section-header'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'
import StatCard from '@directwerk/ui/components/stat-card'

import CreateTenantForm from '@/components/CreateTenantForm'
import {AdminLoadingText, StatCardsSkeleton, TableSkeleton} from '@/components/AdminLoading'
import RecentAuditTable from '@/components/RecentAuditTable'
import TenantListTable from '@/components/TenantListTable'
import {getPlatformData, getPlatformJobList, getPlatformOverview} from '@/lib/api/client'
import {usePlatformQuery} from '@/lib/api/usePlatformQuery'
import type {PlatformOverview, TenantList} from '@directwerk/api/types'

interface OverviewData {
    overview: PlatformOverview
    tenants: TenantList['content']
    adminCount: number
    jobCount: number
}

export default function HomePage(): React.JSX.Element {
    const {data, error, reload: reloadTenants} = usePlatformQuery<OverviewData>(
        async () => {
            const [overviewResult, tenantResult, admins, jobs] = await Promise.all([
                getPlatformOverview(8),
                getPlatformData<TenantList>('tenants'),
                getPlatformData<Array<{userId: number}>>('admins'),
                getPlatformJobList({limit: 1, offset: 0}),
            ])
            return {
                overview: overviewResult,
                tenants: tenantResult.content ?? [],
                adminCount: admins.length,
                jobCount: jobs.total,
            }
        },
        {fallbackError: 'Could not load platform overview.'},
    )

    const overview = data?.overview ?? null
    const tenants = data?.tenants ?? null
    const adminCount = data?.adminCount ?? null
    const jobCount = data?.jobCount ?? null

    return (
        <PageStack>
            <PageHeader
                description="Platform operations only — tenant content and subscribers stay in directwerk-studio."
                eyebrow="Platform administration"
                title="Overview"
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

            {!error && overview === null ? (
                <>
                    <StatCardsSkeleton />
                    <AdminLoadingText text="Loading platform overview…" />
                </>
            ) : null}

            {overview ? (
                <section aria-label="Platform totals" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        footer={<Link href="/tenants">View tenants</Link>}
                        hint="Tenants in good standing"
                        label="Active tenants"
                        value={overview.tenantCounts.active}
                    />
                    <StatCard
                        footer={<Link href="/tenants">View suspended</Link>}
                        hint="Blocked from serving traffic"
                        label="Suspended tenants"
                        value={overview.tenantCounts.suspended}
                    />
                    <StatCard
                        footer={<Link href="/admins">Manage admins</Link>}
                        hint="Users with platform access"
                        label="Platform admins"
                        value={adminCount ?? '—'}
                    />
                    <StatCard
                        footer={<Link href="/jobs">View jobs</Link>}
                        hint="Across all queues"
                        label="Queue jobs"
                        value={jobCount ?? '—'}
                    />
                </section>
            ) : null}

            {overview && overview.moduleAdoption.length > 0 ? (
                <section className="space-y-3">
                    <SectionHeader
                        description="How many tenants have each module enabled."
                        title="Module adoption"
                    />
                    <ResponsiveTable label="Module adoption">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Module</TableHead>
                                    <TableHead scope="col">Tenants</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {overview.moduleAdoption.map((entry) => (
                                    <TableRow key={entry.moduleKey}>
                                        <TableCell className="font-medium">
                                            {entry.moduleKey}
                                        </TableCell>
                                        <TableCell>{entry.tenantCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ResponsiveTable>
                </section>
            ) : null}

            {overview ? (
                <section className="space-y-3">
                    <SectionHeader
                        action={<Link href="/audit">Full audit log</Link>}
                        description="Latest platform-admin actions."
                        title="Recent audit events"
                    />
                    {overview.recentAudit.length > 0 ? (
                        <ResponsiveTable label="Recent audit events">
                            <RecentAuditTable events={overview.recentAudit} />
                        </ResponsiveTable>
                    ) : (
                        <EmptyState
                            description="Admin actions will appear here."
                            title="No audit events yet"
                        />
                    )}
                </section>
            ) : null}

            <SectionHeader
                action={<Link href="/tenants">All tenants</Link>}
                description="Newest tenants. Search and filter on the tenants page."
                title="Tenants"
            />

            {!error && tenants === null ? (
                <>
                    <TableSkeleton rows={4} />
                    <AdminLoadingText text="Loading tenants…" />
                </>
            ) : null}

            {tenants ? (
                tenants.length > 0 ? (
                    <TenantListTable showFilters={false} tenants={tenants} />
                ) : (
                    <EmptyState
                        description="Create the first tenant to begin."
                        title="No tenants yet"
                    />
                )
            ) : null}

            <CreateTenantForm onCreated={reloadTenants} />
        </PageStack>
    )
}
