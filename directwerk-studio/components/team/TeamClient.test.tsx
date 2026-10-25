import {fireEvent, screen, waitFor, within} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {describe, expect, it, vi} from 'vitest'

import TeamClient from '@/components/team/TeamClient'
import {listTenantUsers, replaceUserRestrictions} from '@/lib/api/tenantSettingsApi'
import {MeProvider} from '@/lib/auth/MeProvider'
import type {TenantUser} from '@directwerk/api/types'

// The load effect depends on the router object: it must be stable across
// renders or the effect re-runs forever and loading never finishes.
const mockRouter = {replace: vi.fn()}
vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantSettingsApi', () => ({
    listTenantUsers: vi.fn().mockResolvedValue({content: [], totalElements: 0, page: 0, size: 50}),
    inviteTenantUser: vi.fn(),
    deactivateTenantUser: vi.fn(),
    reactivateTenantUser: vi.fn(),
    listUserRestrictions: vi.fn().mockResolvedValue([]),
    replaceUserRestrictions: vi.fn(),
}))

const admin: TenantUser = {
    userId: 1,
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['TENANT_ADMIN'],
    status: 'ACTIVE',
    invitedAt: null,
    lastLoginAt: null,
}

const editor: TenantUser = {
    userId: 5,
    email: 'editor@example.com',
    name: 'Editor',
    roles: ['EDITOR'],
    status: 'ACTIVE',
    invitedAt: null,
    lastLoginAt: null,
}

function pageOf(...content: TenantUser[]) {
    return {content, totalElements: content.length, page: 0, size: 50}
}

function renderTeam() {
    renderWithLocale(
        <MeProvider
            me={{userId: 1, email: 'admin@example.com', name: 'Admin', roles: ['TENANT_ADMIN'], tenantId: 1}}
        >
            <TeamClient />
        </MeProvider>,
    )
}

describe('TeamClient RBAC', () => {
    it('shows the rights section with a member picker for editors', async () => {
        vi.mocked(listTenantUsers).mockResolvedValue(pageOf(admin, editor))
        renderTeam()

        expect(await screen.findByText('Zugriffsrechte')).toBeInTheDocument()
        expect(screen.getByText(/Redakteure haben standardmäßig/)).toBeInTheDocument()
        const dialog = screen.getByLabelText('Mitglied')
        expect(dialog).toHaveValue('5')
        expect(await screen.findByLabelText('Folgen: Löschen')).toBeInTheDocument()
        expect(listTenantUsers).toHaveBeenCalledWith(
            expect.objectContaining({page: 0, size: 50}),
        )
    })

    it('saves restriction changes for the selected member', async () => {
        vi.mocked(listTenantUsers).mockResolvedValue(pageOf(admin, editor))
        vi.mocked(replaceUserRestrictions).mockResolvedValue([
            {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
        ])
        renderTeam()

        const select = await screen.findByLabelText('Folgen: Löschen')
        fireEvent.change(select, {target: {value: 'DENIED'}})
        fireEvent.click(screen.getByRole('button', {name: 'Rechte speichern'}))

        await waitFor(() =>
            expect(replaceUserRestrictions).toHaveBeenCalledWith(5, [
                {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
            ]),
        )
        expect(await screen.findByText('Zugriffsrechte gespeichert.')).toBeInTheDocument()
    })

    it('hides the rights editor when no editors exist', async () => {
        vi.mocked(listTenantUsers).mockResolvedValue(pageOf(admin))
        renderTeam()

        expect(await screen.findByText('Zugriffsrechte')).toBeInTheDocument()
        expect(
            await screen.findByText(/Keine aktiven Redakteure vorhanden/),
        ).toBeInTheDocument()
        expect(within(document.body).queryByLabelText('Folgen: Löschen')).not.toBeInTheDocument()
    })

    it('sends server-side search to the directory endpoint', async () => {
        vi.mocked(listTenantUsers).mockResolvedValue(pageOf(admin, editor))
        renderTeam()
        await screen.findByText('Zugriffsrechte')

        fireEvent.change(screen.getByLabelText('Suchen'), {target: {value: 'editor'}})

        await waitFor(() =>
            expect(listTenantUsers).toHaveBeenCalledWith(
                expect.objectContaining({page: 0, size: 50, q: 'editor'}),
            ),
        )
    })
})
