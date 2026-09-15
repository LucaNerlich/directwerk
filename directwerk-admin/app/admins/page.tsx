'use client'

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
import {getPlatformData} from '@/lib/api/client'
import {usePlatformQuery} from '@/lib/api/usePlatformQuery'
import type {PlatformAdmin} from '@directwerk/api/types'
import {Button} from '@directwerk/ui/components/button'

export default function PlatformAdminsPage() {
    const {data: admins, error, reload: loadAdmins} = usePlatformQuery(
        () => getPlatformData<PlatformAdmin[]>('admins'),
        {fallbackError: 'Could not load platform admins.'},
    )
    const {viewMode, setViewMode} = useListViewMode()

    const adminItems: EntityListViewItem[] =
        admins?.map((admin) => {
            const isLastAdmin = admins.length <= 1
            return {
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
                        isLastAdmin
                            ? 'Cannot revoke the last platform admin.'
                            : null
                    }
                    onRevoked={loadAdmins}
                    userId={admin.userId}
                />
            ),
            }
        }) ?? []

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
                    <InvitePlatformAdminForm onInvited={loadAdmins} />
                </>
            ) : null}
        </PageStack>
    )
}
