'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {use, useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button, buttonVariants} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AdminBreadcrumbs from '@/components/AdminBreadcrumbs'
import {AdminLoadingText, FormSkeleton, TableSkeleton} from '@/components/AdminLoading'

import DomainForceVerifyForm from '@/components/DomainForceVerifyForm'
import InviteTenantUserForm from '@/components/InviteTenantUserForm'
import TenantAnalyticsCard from '@/components/TenantAnalyticsCard'
import TenantEditForm from '@/components/TenantEditForm'
import TenantUploadLimitsForm from '@/components/TenantUploadLimitsForm'
import TenantModulesPanel from '@/components/TenantModulesPanel'
import TenantProductsPanel from '@/components/TenantProductsPanel'
import TenantSessionPanel from '@/components/TenantSessionPanel'
import TenantUserActions from '@/components/TenantUserActions'
import {getMemberEffectiveRights, getPlatformData, postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED, REQUEST_FAILED} from '@directwerk/api/constants'
import type {EffectiveRights, TenantDetail, TenantDetailResponse, TenantUser, TenantUsers} from '@directwerk/api/types'

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
    const [reloadKey, setReloadKey] = useState(0)
    const [rightsByUser, setRightsByUser] = useState<Record<number, EffectiveRights | null>>({})

    const loadTenantData = useCallback(() => {        if (!/^\d+$/.test(id)) {
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

                // Read-only RBAC overview (issue #148): resolve restriction
                // summaries for editors; failures stay silent per row.
                const editors = users.content.filter((user) => user.roles.includes('EDITOR'))
                void Promise.all(
                    editors.map(async (user) => {
                        try {
                            const rights = await getMemberEffectiveRights(id, user.userId)
                            if (isCurrent) {
                                setRightsByUser((current) => ({...current, [user.userId]: rights}))
                            }
                        } catch {
                            if (isCurrent) {
                                setRightsByUser((current) => ({...current, [user.userId]: null}))
                            }
                        }
                    }),
                )
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
    }, [id, router, reloadKey])

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

    function rightsSummary(user: TenantUser): string {
        if (!user.roles.includes('EDITOR')) {
            return 'Rights: full access'
        }
        const rights = rightsByUser[user.userId]
        if (rights === undefined) {
            return 'Rights: loading…'
        }
        if (rights === null || rights.restrictions.length === 0) {
            return 'Rights: full access'
        }
        const details = rights.restrictions
            .map((restriction) => `${restriction.entityType}/${restriction.operation}`)
            .join(', ')
        return `Rights: ${rights.restrictions.length} restriction${rights.restrictions.length === 1 ? '' : 's'} (${details})`
    }

    return (
        <PageStack>
                <AdminBreadcrumbs
                    items={[
                        {href: '/tenants', label: 'Tenants'},
                        {label: data?.tenant.name ?? `Tenant ${id}`},
                    ]}
                />
                {error ? (
                    <>
                        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                        <div>
                            <Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline">
                                Retry
                            </Button>
                        </div>
                    </>
                ) : null}
                {!error && isInitialLoad ? (
                    <>
                        <TableSkeleton rows={3} />
                        <FormSkeleton />
                        <AdminLoadingText text="Loading tenant details…" />
                    </>
                ) : null}
                {data ? (
                    <>
                        <PageHeader
                            actions={<Link className={buttonVariants()} href={`/tenants/${id}/storage`}>Storage</Link>}
                            description={`Tenant slug: ${data.tenant.slug}`}
                            eyebrow="Tenant"
                            title={data.tenant.name}
                        />
                        <Card>
                            <CardHeader>
                                <CardTitle>Overview</CardTitle>
                                <CardDescription>
                                    Identity, lifecycle status, and content totals.
                                </CardDescription>
                            </CardHeader>
                            <CardContent><dl className="grid gap-4 sm:grid-cols-2 [&_dd]:mt-1 [&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-muted-foreground">
                            <div>
                                <dt>Slug</dt>
                                <dd>{data.tenant.slug}</dd>
                            </div>
                            <div>
                                <dt>Status</dt>
                                <dd><Badge variant={data.tenant.status === 'ACTIVE' ? 'default' : 'outline'}>{data.tenant.status}</Badge></dd>
                            </div>
                            <div>
                                <dt>Created</dt>
                                <dd>{new Date(data.tenant.createdAt).toLocaleString()}</dd>
                            </div>
                            <div>
                                <dt>Primary domain</dt>
                                <dd>{data.tenant.primaryDomain ?? '—'}</dd>
                            </div>
                            <div>
                                <dt>Episodes</dt>
                                <dd>{data.episodeCount}</dd>
                            </div>
                            <div>
                                <dt>Subscribers</dt>
                                <dd>{data.subscriberCount}</dd>
                            </div>
                            </dl></CardContent>
                        </Card>

                        {data.tenant.domains.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Domains</CardTitle>
                                    <CardDescription>
                                        Verified domains can serve tenant traffic.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <EntityListView
                                        ariaLabel="Tenant domains"
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

                        <TenantUploadLimitsForm
                            limits={data.tenant.uploadLimits}
                            onSaved={() => setReloadKey((value) => value + 1)}
                            tenantId={id}
                        />

                        <Card aria-labelledby="tenant-lifecycle-heading" role="region">
                            <CardHeader>
                                <CardTitle id="tenant-lifecycle-heading">Lifecycle</CardTitle>
                                <CardDescription>
                                    Suspending blocks all tenant traffic immediately;
                                    reactivating restores it.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                            {lifecycleError ? (
                                <Alert aria-live="polite" variant="destructive"><AlertDescription>{lifecycleError}</AlertDescription></Alert>
                            ) : null}
                            {lifecycleStatus ? (
                                <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
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

                        <TenantAnalyticsCard tenantId={id} />

                        <TenantSessionPanel
                            onSessionChange={() =>
                                setTenantSessionKey((value) => value + 1)
                            }
                        />

                        <DomainForceVerifyForm onVerified={loadTenantData} tenantId={id} />

                        <TenantProductsPanel sessionKey={tenantSessionKey} />

                        <SectionHeader
                            description={`${data.users.length} member${data.users.length === 1 ? '' : 's'}. Deactivating removes access immediately.`}
                            title="Users"
                        />
                        {data.users.length > 0 ? (
                            <EntityListSection
                                ariaLabel="Tenant users"
                                items={data.users.map((user): EntityListViewItem => ({
                                    id: user.userId,
                                    title: user.name ?? user.email,
                                    description: user.name !== null ? user.email : undefined,
                                    descriptions: [
                                        `Roles: ${user.roles.join(', ')}`,
                                        rightsSummary(user),
                                        user.lastLoginAt
                                            ? `Last login: ${new Date(user.lastLoginAt).toLocaleString()}`
                                            : 'Last login: —',
                                    ],
                                    trailing: <Badge variant="outline">{user.status}</Badge>,
                                    extra: (
                                        <TenantUserActions
                                            onChanged={loadTenantData}
                                            tenantId={id}
                                            user={user}
                                        />
                                    ),
                                }))}
                                showSelection={false}
                                showViewToggle={false}
                                viewMode="list"
                            />
                        ) : (
                            <EmptyState
                                description="Invite the first member below."
                                title="No users"
                            />
                        )}

                        <InviteTenantUserForm
                            onInvited={loadTenantData}
                            tenantId={id}
                        />
                    </>
                ) : null}
        </PageStack>
    )
}
