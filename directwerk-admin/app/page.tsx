'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import SectionHeader from '@directwerk/ui/components/section-header'
import StatCard from '@directwerk/ui/components/stat-card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import CreateTenantForm from '@/components/CreateTenantForm'
import {getPlatformData, getPlatformJobList} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PlatformAdmin, Tenant, TenantList} from '@directwerk/api/types'

export default function HomePage() {
    const router = useRouter()
    const [tenants, setTenants] = useState<Tenant[] | null>(null)
    const [adminCount, setAdminCount] = useState<number | null>(null)
    const [jobCount, setJobCount] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const reloadTenants = useCallback(() => {
        setReloadKey((value) => value + 1)
    }, [])

    useEffect(() => {
        let active = true

        Promise.all([
            getPlatformData<TenantList>('tenants'),
            getPlatformData<PlatformAdmin[]>('admins'),
            getPlatformJobList({limit: 1, offset: 0}),
        ])
            .then(([result, admins, jobs]) => {
                if (active) {
                    setTenants(result.content)
                    setAdminCount(admins.length)
                    setJobCount(jobs.total)
                    setError(null)
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

                setError('Could not load platform overview.')
            })

        return () => {
            active = false
        }
    }, [router, reloadKey])

    return (
        <PageStack>
            <PageHeader
                description="Platform operations only — tenant content and subscribers stay in directwerk-studio."
                eyebrow="Platform administration"
                title="Overview"
            />
            {tenants !== null ? (
                <section className="grid gap-3 sm:grid-cols-3">
                    <StatCard
                        hint={`${tenants.filter((tenant) => tenant.status === 'ACTIVE').length} active`}
                        label="Tenants"
                        value={tenants.length}
                    />
                    <StatCard
                        footer={<Link href="/admins">Manage admins</Link>}
                        label="Platform admins"
                        value={adminCount ?? '—'}
                    />
                    <StatCard
                        footer={<Link href="/jobs">View jobs</Link>}
                        label="Queue jobs"
                        value={jobCount ?? '—'}
                    />
                </section>
            ) : null}
            <SectionHeader title="Tenants" />
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            {!error && tenants === null ? (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                    Loading tenants…
                </p>
            ) : null}
            {tenants ? (
                tenants.length > 0 ? (
                    <ResponsiveTable label="Tenants">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Name</TableHead>
                                    <TableHead scope="col">Slug</TableHead>
                                    <TableHead scope="col">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tenants.map((tenant) => (
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
                                        <TableCell>
                                            <Badge variant="outline">{tenant.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ResponsiveTable>
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
