import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {getMyEffectiveRights} from '@/lib/api/tenantSettingsApi'
import {MeProvider} from '@/lib/auth/MeProvider'
import {useDeskAccess} from '@/lib/rbac/useDeskAccess'

vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantSettingsApi', () => ({
    getMyEffectiveRights: vi.fn().mockResolvedValue(null),
}))

function Probe({
    ownerUserId,
}: {
    ownerUserId?: number | null
}) {
    const desk = useDeskAccess({entity: 'EPISODE', ownerUserId, kind: 'Folge'})
    return (
        <p data-testid="access">
            {desk.canEdit ? 'edit' : 'locked'}|{desk.canPublish ? 'publish' : 'blocked'}|
            {desk.canDelete ? 'delete' : 'nodelete'}|{desk.editBlockedReason ?? 'ok'}|
            {desk.publishBlockedReason ?? 'ok'}
        </p>
    )
}

function renderProbe(
    ownerUserId?: number | null,
    userId: number | null = 5,
    roles: string[] = ['EDITOR'],
) {
    const me =
        userId === null
            ? null
            : {userId, email: 'e@x.de', name: 'E', roles, tenantId: 1}
    render(
        <MeProvider me={me}>
            <Probe ownerUserId={ownerUserId} />
        </MeProvider>,
    )
}

describe('useDeskAccess', () => {
    it('allows everything while rights load and without restrictions', async () => {
        renderProbe(99)
        expect(await screen.findByTestId('access')).toHaveTextContent('edit|publish|delete|ok')
    })

    it('locks foreign rows under own-only rights and keeps own rows editable', async () => {
        vi.mocked(getMyEffectiveRights).mockResolvedValue({
            userId: 5,
            roles: ['EDITOR'],
            restrictions: [],
            effective: {EPISODE: {UPDATE: 'OWN_ONLY', PUBLISH: 'FULL', DELETE: 'FULL'}},
        })
        const {unmount} = render(
            <MeProvider
                me={{userId: 5, email: 'e@x.de', name: 'E', roles: ['EDITOR'], tenantId: 1}}
            >
                <Probe ownerUserId={99} />
            </MeProvider>,
        )
        await waitFor(() =>
            expect(screen.getByTestId('access')).toHaveTextContent(/locked/),
        )
        expect(screen.getByTestId('access')).toHaveTextContent(/eigene Folgen/)
        unmount()

        render(
            <MeProvider
                me={{userId: 5, email: 'e@x.de', name: 'E', roles: ['EDITOR'], tenantId: 1}}
            >
                <Probe ownerUserId={5} />
            </MeProvider>,
        )
        await waitFor(() =>
            expect(screen.getAllByTestId('access').at(-1)).toHaveTextContent(
                'edit|publish|delete|ok',
            ),
        )
    })

    it('treats not-yet-existing rows as own', async () => {
        vi.mocked(getMyEffectiveRights).mockResolvedValue({
            userId: 5,
            roles: ['EDITOR'],
            restrictions: [],
            effective: {EPISODE: {UPDATE: 'OWN_ONLY', PUBLISH: 'OWN_ONLY', DELETE: 'OWN_ONLY'}},
        })
        render(
            <MeProvider
                me={{userId: 5, email: 'e@x.de', name: 'E', roles: ['EDITOR'], tenantId: 1}}
            >
                <Probe ownerUserId={undefined} />
            </MeProvider>,
        )
        await waitFor(() =>
            expect(screen.getByTestId('access')).toHaveTextContent('edit|publish|delete|ok'),
        )
    })

    it('blocks denied operations with reason', async () => {
        vi.mocked(getMyEffectiveRights).mockResolvedValue({
            userId: 5,
            roles: ['EDITOR'],
            restrictions: [],
            effective: {EPISODE: {PUBLISH: 'DENIED'}},
        })
        render(
            <MeProvider
                me={{userId: 5, email: 'e@x.de', name: 'E', roles: ['EDITOR'], tenantId: 1}}
            >
                <Probe ownerUserId={5} />
            </MeProvider>,
        )
        await waitFor(() =>
            expect(screen.getByTestId('access')).toHaveTextContent(/blocked/),
        )
        expect(screen.getByTestId('access')).toHaveTextContent(/eingeschränkt/)
    })
})
