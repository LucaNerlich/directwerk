'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import InvitePlatformAdminForm from '@/components/InvitePlatformAdminForm'
import {AdminLoadingText, TableSkeleton} from '@/components/AdminLoading'
import RevokeAdminButton from '@/components/RevokeAdminButton'
import {getPlatformAdminsPage} from '@/lib/api/client'
import {usePlatformQuery} from '@/lib/api/usePlatformQuery'
import {Button} from '@directwerk/ui/components/button'

const PAGE_SIZE = 25

export default function PlatformAdminsPage() {
    const [page, setPage] = useState(0)
    const {
        data: adminsPage,
        error,
        isLoading,
        reload: loadAdmins,
    } = usePlatformQuery(() => getPlatformAdminsPage(page, PAGE_SIZE), {
        fallbackError: 'Could not load platform admins.',
        queryKey: String(page),
    })
    const {viewMode, setViewMode} = useListViewMode()

    const admins = adminsPage?.content ?? null
    // Judged against the whole estate, not the current page — with paging, a page holding one
    // admin is not the same as the platform having only one admin (#438).
    const isLastAdmin = adminsPage !== null && adminsPage.totalElements <= 1
    const hasPreviousPage = adminsPage !== null && adminsPage.page > 0
    const hasNextPage =
        adminsPage !== null && (adminsPage.page + 1) * adminsPage.size < adminsPage.totalElements

    const adminItems: EntityListViewItem[] =
        admins?.map((admin) => ({
            id: admin.userId,
            title: admin.name ?? admin.email,
            description: admin.name !== null ? admin.email : undefined,
            descriptions: [
                admin.lastLoginAt
                    ? `Last login: ${new Date(admin.lastLoginAt).toLocaleString()}`
                    : 'Last login: —',
            ],
            actions: (
                <RevokeAdminButton
                    disabled={isLastAdmin}
                    disabledReason={
                        isLastAdmin ? 'Cannot revoke the last platform admin.' : null
                    }
                    onRevoked={loadAdmins}
                    userId={admin.userId}
                />
            ),
        })) ?? []

    return (
        <PageStack>
            <PageHeader
                description="Invite administrators and revoke platform-level access."
                eyebrow="Access control"
                title="Platform admins"
            />
            {error ? (
                <>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <div className="mt-2">
                        <Button onClick={() => loadAdmins()} type="button" variant="outline">
                            Retry
                        </Button>
                    </div>
                </>
            ) : null}
            {!error && admins === null ? (
                <>
                    <TableSkeleton rows={3} />
                    <AdminLoadingText text="Loading platform admins…" />
                </>
            ) : null}
            {admins ? (
                <>
                    {admins.length > 0 ? (
                        <EntityListSection
                            ariaLabel="Platform admins"
                            items={adminItems}
                            onViewModeChange={setViewMode}
                            showSelection={false}
                            viewGridLabel="Grid"
                            viewListLabel="List"
                            viewMode={viewMode}
                            viewToggleLabel="Change view"
                        />
                    ) : (
                        <EmptyState
                            description="Invite the first platform admin below. Invitations are delivered by email."
                            title="No platform admins"
                        />
                    )}
                    {!error && !isLoading && adminsPage ? (
                        <>
                            <p aria-live="polite" className="text-sm text-muted-foreground">
                                Showing {adminsPage.content.length} of {adminsPage.totalElements}{' '}
                                admins (page {adminsPage.page + 1}, size {adminsPage.size}).
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    aria-label="Previous platform admin page"
                                    disabled={!hasPreviousPage}
                                    onClick={() => setPage((current) => Math.max(0, current - 1))}
                                    type="button"
                                    variant="outline"
                                >
                                    Previous page
                                </Button>
                                <Button
                                    aria-label="Next platform admin page"
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
                    <InvitePlatformAdminForm onInvited={loadAdmins} />
                </>
            ) : null}
        </PageStack>
    )
}
