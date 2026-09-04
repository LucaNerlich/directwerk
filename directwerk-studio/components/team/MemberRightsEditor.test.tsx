import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import MemberRightsEditor from '@/components/team/MemberRightsEditor'
import {listUserRestrictions, replaceUserRestrictions} from '@/lib/api/tenantSettingsApi'
import type {TenantUser} from '@directwerk/api/types'

vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantSettingsApi', () => ({
    listUserRestrictions: vi.fn().mockResolvedValue([]),
    replaceUserRestrictions: vi.fn(),
}))

const editor: TenantUser = {
    userId: 5,
    email: 'editor@example.com',
    name: 'Editor',
    roles: ['EDITOR'],
    status: 'ACTIVE',
    invitedAt: null,
    lastLoginAt: null,
}

const admin: TenantUser = {
    ...editor,
    userId: 6,
    email: 'admin@example.com',
    roles: ['TENANT_ADMIN'],
}

function renderEditor(user: TenantUser = editor) {
    render(<MemberRightsEditor onAuthRequired={() => {}} user={user} />)
}

describe('MemberRightsEditor', () => {
    it('shows a note instead of controls for tenant admins', async () => {
        renderEditor(admin)

        expect(
            await screen.findByText(/Tenant-Admins haben immer Vollzugriff/),
        ).toBeInTheDocument()
        expect(listUserRestrictions).not.toHaveBeenCalled()
    })

    it('preselects stored restrictions and saves the tri-state matrix', async () => {
        vi.mocked(listUserRestrictions).mockResolvedValue([
            {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
        ])
        vi.mocked(replaceUserRestrictions).mockResolvedValue([
            {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
            {entityType: 'ARTICLE', operation: 'PUBLISH', scope: 'OTHERS_ONLY'},
        ])
        renderEditor()

        const episodeDelete = await screen.findByLabelText('Folgen: Löschen')
        expect(episodeDelete).toHaveValue('DENIED')

        fireEvent.change(screen.getByLabelText('Beiträge: Veröffentlichen'), {
            target: {value: 'OWN_ONLY'},
        })
        fireEvent.click(screen.getByRole('button', {name: 'Rechte speichern'}))

        await waitFor(() =>
            expect(replaceUserRestrictions).toHaveBeenCalledWith('tenant.test', 5, [
                {entityType: 'EPISODE', operation: 'DELETE', scope: 'DENY'},
                {entityType: 'ARTICLE', operation: 'PUBLISH', scope: 'OTHERS_ONLY'},
            ]),
        )
        expect(await screen.findByText('Zugriffsrechte gespeichert.')).toBeInTheDocument()
    })

    it('surfaces server errors in German', async () => {
        vi.mocked(listUserRestrictions).mockResolvedValue([])
        vi.mocked(replaceUserRestrictions).mockRejectedValue(
            new Error('This operation was restricted for your account by a tenant admin'),
        )
        renderEditor()

        await screen.findByLabelText('Folgen: Löschen')
        fireEvent.click(screen.getByRole('button', {name: 'Rechte speichern'}))

        expect(
            await screen.findByText(/für dein Konto eingeschränkt/),
        ).toBeInTheDocument()
    })
})
