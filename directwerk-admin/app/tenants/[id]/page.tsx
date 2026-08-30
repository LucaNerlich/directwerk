'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {use, useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'
import InviteTenantUserForm from '@/components/InviteTenantUserForm'
import TenantEditForm from '@/components/TenantEditForm'
import TenantModulesPanel from '@/components/TenantModulesPanel'
import TenantProductsPanel from '@/components/TenantProductsPanel'
import TenantSessionPanel from '@/components/TenantSessionPanel'
import TenantUserActions from '@/components/TenantUserActions'
import {getPlatformData, postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, REQUEST_FAILED} from '@directwerk/api/constants'
import type {TenantDetail, TenantDetailResponse, TenantUser, TenantUsers} from '@directwerk/api/types'

interface TenantPageProps {
    params: Promise<{id: string}>
}

interface TenantPageData {
    tenant: TenantDetail
    episodeCount: number
    subscriberCount: number
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
    const {viewMode, setViewMode} = useListViewMode()

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
            getPlatformData<TenantDetailResponse>(`tenants/${id}`),
            getPlatformData<TenantUsers>(`tenants/${id}/users`),
        ])
            .then(([tenantResponse, users]) => {
                if (!isCurrent) {
                    return
                }

                setData({
                    tenant: tenantResponse.tenant,
                    episodeCount: tenantResponse.episodeCount,
                    subscriberCount: tenantResponse.subscriberCount,
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
            const tenantResponse = await postPlatformData<TenantDetail>(path, {})
            setData((current) =>
                current
                    ? {
                          ...current,
                          tenant: tenantResponse,
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
                            <dt>Created</dt>
                            <dd>{new Date(data.tenant.createdAt).toLocaleString()}</dd>
                            <dt>Primary domain</dt>
                            <dd>{data.tenant.primaryDomain ?? '—'}</dd>
                            <dt>Episodes</dt>
                            <dd>{data.episodeCount}</dd>
                            <dt>Subscribers</dt>
                            <dd>{data.subscriberCount}</dd>
                            </dl></CardContent>
                        </Card>

                        {data.tenant.domains.length > 0 ? (
                            <Card>
                                <CardHeader><CardTitle>Domains</CardTitle></CardHeader>
                                <CardContent>
                                    <EntityListView
                                        items={data.tenant.domains.map((domain) => ({
                                            id: domain.host,
                                            title: domain.host,
                                            descriptions: [
                                                domain.primary ? 'Primary' : 'Secondary',
                                                domain.verified ? 'Verified' : 'Not verified',
                                            ],
                                        }))}
                                        viewMode="list"
                                    />
                                </CardContent>
                            </Card>
                        ) : null}

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
                            <EntityListSection
                                items={data.users.map((user): EntityListViewItem => ({
                                    id: user.userId,
                                    title: user.name ?? user.email,
                                    description: user.name !== null ? user.email : undefined,
                                    descriptions: [
                                        `Roles: ${user.roles.join(', ')}`,
                                        user.lastLoginAt
                                            ? `Last login: ${new Date(user.lastLoginAt).toLocaleString()}`
                                            : 'Last login: —',
                                    ],
                                    trailing: <Badge variant="outline">{user.status}</Badge>,
                                    actions: (
                                        <TenantUserActions
                                            onChanged={loadTenantData}
                                            tenantId={id}
                                            user={user}
                                        />
                                    ),
                                }))}
                                onViewModeChange={setViewMode}
                                showSelection={false}
                                viewMode={viewMode}
                            />
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
