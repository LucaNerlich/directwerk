'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {use, useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'
import InviteTenantUserForm from '@/components/InviteTenantUserForm'
import TenantEditForm from '@/components/TenantEditForm'
import TenantModulesPanel from '@/components/TenantModulesPanel'
import TenantProductsPanel from '@/components/TenantProductsPanel'
import TenantSessionPanel from '@/components/TenantSessionPanel'
import TenantUserActions from '@/components/TenantUserActions'
import {getPlatformData, postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, REQUEST_FAILED} from '@directwerk/api/constants'
import type {Tenant, TenantUser, TenantUsers} from '@directwerk/api/types'

interface TenantPageProps {
    params: Promise<{id: string}>
}

interface TenantPageData {
    tenant: Tenant
    users: TenantUser[]
}

export default function TenantPage({params}: TenantPageProps) {
    const {id} = use(params)
    const router = useRouter()
    const [data, setData] = useState<TenantPageData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [lifecycleError, setLifecycleError] = useState<string | null>(null)
    const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null)
    const [isInitialLoad, setIsInitialLoad] = useState(true)
    const [lifecycleBusy, setLifecycleBusy] = useState(false)
    const [tenantSessionKey, setTenantSessionKey] = useState(0)

    const loadTenantData = useCallback(() => {
        if (!/^\d+$/.test(id)) {
            setError('Invalid tenant identifier.')
            setData(null)
            setIsInitialLoad(false)
            return () => undefined
        }

        setError(null)

        let isCurrent = true

        Promise.all([
            getPlatformData<Tenant>(`tenants/${id}`),
            getPlatformData<TenantUsers>(`tenants/${id}/users`),
        ])
            .then(([tenant, users]) => {
                if (!isCurrent) {
                    return
                }

                setData({
                    tenant,
                    users: users.content,
                })
                setIsInitialLoad(false)
            })
            .catch((requestError: unknown) => {
                if (!isCurrent) {
                    return
                }

                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }

                setError('Could not load tenant details.')
                setIsInitialLoad(false)
            })

        return () => {
            isCurrent = false
        }
    }, [id, router])

    useEffect(() => {
        return loadTenantData()
    }, [loadTenantData])

    async function runLifecycle(
        path: string,
        successMessage: string
    ): Promise<void> {
        setLifecycleBusy(true)
        setLifecycleError(null)
        setLifecycleStatus(null)

        try {
            const tenant = await postPlatformData<Tenant>(path, {})
            setData((current) =>
                current
                    ? {
                          ...current,
                          tenant,
                      }
                    : current
            )
            setLifecycleStatus(successMessage)
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace('/login')
                return
            }

            if (
                requestError instanceof Error &&
                requestError.message === REQUEST_FAILED
            ) {
                setLifecycleError(
                    'Lifecycle update failed. Try again later.'
                )
                return
            }

            setLifecycleError('Lifecycle update is unavailable.')
        } finally {
            setLifecycleBusy(false)
        }
    }

    return (
        <div className="space-y-8">
                {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
                {!error && isInitialLoad ? <p aria-live="polite" className="text-sm text-muted-foreground">Loading tenant details…</p> : null}
                {data ? (
                    <>
                        <PageHeader
                            actions={<Button render={<Link href={`/tenants/${id}/storage`} />}>Storage</Button>}
                            description={`Tenant slug: ${data.tenant.slug}`}
                            eyebrow="Tenant"
                            title={data.tenant.name}
                        />
                        <Card>
                            <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
                            <CardContent><dl className="grid gap-4 sm:grid-cols-2 [&_dd]:mt-1 [&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-muted-foreground">
                            <dt>Slug</dt>
                            <dd>{data.tenant.slug}</dd>
                            <dt>Status</dt>
                            <dd><Badge variant="outline">{data.tenant.status}</Badge></dd>
                            </dl></CardContent>
                        </Card>

                        <TenantEditForm
                            onUpdated={(tenant) =>
                                setData((current) =>
                                    current ? {...current, tenant} : current
                                )
                            }
                            tenant={data.tenant}
                            tenantId={id}
                        />

                        <Card aria-labelledby="tenant-lifecycle-heading" role="region">
                            <CardHeader><CardTitle id="tenant-lifecycle-heading">Lifecycle</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                            {lifecycleError ? (
                                <Alert aria-live="polite" variant="destructive"><AlertDescription>{lifecycleError}</AlertDescription></Alert>
                            ) : null}
                            {lifecycleStatus ? (
                                <p aria-live="polite" role="status">
                                    {lifecycleStatus}
                                </p>
                            ) : null}
                            {data.tenant.status === 'ACTIVE' ? (
                                <Button
                                    disabled={lifecycleBusy}
                                    onClick={() => {
                                        const confirmed = window.confirm(
                                            'Suspend this tenant? All of its users will immediately lose access.',
                                        )
                                        if (!confirmed) {
                                            return
                                        }
                                        void runLifecycle(
                                            `tenants/${id}/suspend`,
                                            'Tenant suspended.'
                                        )
                                    }}
                                    type="button"
                                    variant="destructive"
                                >
                                    {lifecycleBusy ? 'Working…' : 'Suspend'}
                                </Button>
                            ) : (
                                <Button
                                    disabled={lifecycleBusy}
                                    onClick={() =>
                                        void runLifecycle(
                                            `tenants/${id}/reactivate`,
                                            'Tenant reactivated.'
                                        )
                                    }
                                    type="button"
                                >
                                    {lifecycleBusy
                                        ? 'Working…'
                                        : 'Reactivate'}
                                </Button>
                            )}
                            </CardContent>
                        </Card>

                        <TenantModulesPanel tenantId={id} />

                        <TenantSessionPanel
                            onSessionChange={() =>
                                setTenantSessionKey((value) => value + 1)
                            }
                        />

                        <DomainForceVerifyForm tenantId={id} />

                        <TenantProductsPanel sessionKey={tenantSessionKey} />

                        <h2 className="text-2xl font-semibold tracking-tight">Users</h2>
                        {data.users.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">Name</TableHead>
                                        <TableHead scope="col">Email</TableHead>
                                        <TableHead scope="col">Roles</TableHead>
                                        <TableHead scope="col">Status</TableHead>
                                        <TableHead scope="col">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.users.map((user) => (
                                        <TableRow key={user.userId}>
                                            <TableCell>{user.name ?? '—'}</TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell>{user.roles.join(', ')}</TableCell>
                                            <TableCell><Badge variant="outline">{user.status}</Badge></TableCell>
                                            <TableCell>
                                                <TenantUserActions
                                                    onChanged={loadTenantData}
                                                    tenantId={id}
                                                    user={user}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <EmptyState title="No users" />
                        )}

                        <InviteTenantUserForm
                            onInvited={loadTenantData}
                            tenantId={id}
                        />
                    </>
                ) : null}
        </div>
    )
}
