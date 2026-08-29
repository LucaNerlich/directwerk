import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import FormatEditor from '@/components/podcast/FormatEditor'
import {clearCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'

const replace = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({replace})}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))

const createFormat = vi.fn().mockResolvedValue({
    id: 1,
    slug: 'interview',
    name: 'Interview',
    active: true,
    description: null,
    requiredLevelSortOrder: null,
    sortOrder: 0,
})
vi.mock('@/lib/api/catalogApi', () => ({
    createFormat: (...args: unknown[]) => createFormat(...args),
    updateFormat: vi.fn(),
    deactivateFormat: vi.fn(),
    listFormats: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listPublicLevels: vi.fn().mockResolvedValue([
        {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
        {id: 2, slug: 'supporter', title: 'Supporter', sortOrder: 20},
    ]),
}))

describe('FormatEditor', () => {
    beforeEach(() => {
        clearCachedTenantData('public-levels', 'tenant.test')
    })

    it('renders Mindest-Stufe and Sortierung labels with helper texts', () => {
        render(<FormatEditor />)

        expect(screen.getByLabelText('Mindest-Stufe')).toBeInTheDocument()
        expect(
            screen.getByLabelText('Anzeigereihenfolge in der Formatauswahl'),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/Niedrigste Stufe, die auf Folgen dieses Formats zugreifen darf/),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/erscheint — hat nichts mit Zugriff zu tun/),
        ).toBeInTheDocument()
    })

    it('offers the level catalog in the Mindest-Stufe dropdown', async () => {
        render(<FormatEditor />)

        expect(
            await screen.findByRole('option', {name: 'Öffentlich / Keine Mindeststufe'}),
        ).toBeInTheDocument()
        expect(
            await screen.findByRole('option', {name: 'Fan (10)'}),
        ).toBeInTheDocument()
        expect(
            await screen.findByRole('option', {name: 'Supporter (20)'}),
        ).toBeInTheDocument()
    })

    it('creates a new format and redirects to its detail page', async () => {
        const user = userEvent.setup()
        render(<FormatEditor />)

        await user.type(screen.getByLabelText('Name'), 'Interview')
        await user.type(screen.getByLabelText('Slug'), 'interview')
        await user.click(screen.getByRole('button', {name: /Speichern/}))

        await waitFor(() => expect(createFormat).toHaveBeenCalledWith('tenant.test', {
            slug: 'interview',
            name: 'Interview',
            description: undefined,
            requiredLevelSortOrder: undefined,
            sortOrder: undefined,
        }))
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/podcast/formats/1'))
    })
})
