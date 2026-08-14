'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Badge} from '@publish/ui/components/badge'
import EmptyState from '@publish/ui/components/empty-state'
import PageHeader from '@publish/ui/components/page-header'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@publish/ui/components/table'

import CreateTenantForm from '@/components/CreateTenantForm'
import {getPlatformData, getPlatformJobList} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {PlatformAdmin, Tenant, TenantList} from '@/lib/api/types'

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
            getPlatformData<PlatformAdmin[]>('admins').catch(() => []),
            getPlatformJobList({limit: 1, offset: 0}).catch(() => ({
                items: [],
                total: 0,
                offset: 0,
                limit: 1,
            })),
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

                setError('Could not load tenants.')
            })

        return () => {
            active = false
        }
    }, [router, reloadKey])

    return (
        <div className="space-y-8">
            <PageHeader
                description="Platform operations only — tenant content and subscribers stay in publish-studio."
                eyebrow="Platform administration"
                title="Overview"
            />
            {tenants !== null ? (
                <section className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Tenants
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{tenants.length}</p>
                        <p className="text-sm text-muted-foreground">
                            {tenants.filter((tenant) => tenant.status === 'ACTIVE').length} active
                        </p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Platform admins
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{adminCount ?? '—'}</p>
                        <p className="text-sm">
                            <Link href="/admins">Manage admins</Link>
                        </p>
                    </div>
                    <div className="rounded-xl border bg-card p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Queue jobs
                        </p>
                        <p className="mt-2 text-2xl font-semibold">{jobCount ?? '—'}</p>
                        <p className="text-sm">
                            <Link href="/jobs">View jobs</Link>
                        </p>
                    </div>
                </section>
            ) : null}
            <h2 className="text-xl font-semibold">Tenants</h2>
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
                                    <Link className="font-medium underline-offset-4 hover:underline" href={`/tenants/${tenant.id}`}>
                                        {tenant.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{tenant.slug}</TableCell>
                                <TableCell><Badge variant="outline">{tenant.status}</Badge></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                ) : (
                    <EmptyState
                        description="Create the first tenant to begin."
                        title="No tenants yet"
                    />
                )
            ) : null}

            <CreateTenantForm onCreated={reloadTenants} />
        </div>
    )
}
