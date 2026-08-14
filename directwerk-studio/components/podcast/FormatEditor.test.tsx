import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import FormatEditor from '@/components/podcast/FormatEditor'

const replace = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({replace})}))
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
vi.mock('@/lib/api/tenantApi', () => ({
    createFormat: (...args: unknown[]) => createFormat(...args),
    updateFormat: vi.fn(),
    deactivateFormat: vi.fn(),
    listFormats: vi.fn().mockResolvedValue([]),
    suggestSlug: (title: string) => title.toLowerCase(),
}))

describe('FormatEditor', () => {
    it('renders Mindest-Stufe and Sortierung labels with helper texts', () => {
        render(<FormatEditor />)

        expect(screen.getByLabelText('Mindest-Stufe')).toBeInTheDocument()
        expect(screen.getByLabelText('Sortierung')).toBeInTheDocument()
        expect(
            screen.getByText(/Niedrigste Stufe \(Sortierzahl\), die auf Folgen dieses Formats zugreifen darf/),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/Reihenfolge in der Formate-Auswahl — hat nichts mit Zugriff zu tun/),
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
