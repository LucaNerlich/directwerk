import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import FormatListClient from '@/components/podcast/FormatListClient'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/catalogApi', () => ({
    listFormats: vi.fn().mockResolvedValue([
        {
            id: 1,
            slug: 'interview',
            name: 'Interview',
            active: true,
            description: null,
            requiredLevelSortOrder: null,
            sortOrder: 0,
        },
    ]),
}))

describe('FormatListClient', () => {
    it('renders loaded formats under podcast setup paths', async () => {
        render(<FormatListClient />)
        await waitFor(() => expect(screen.getByText('Interview')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: /Neues Format/})).toHaveAttribute(
            'href',
            '/podcast/formats/new',
        )
    })
})
