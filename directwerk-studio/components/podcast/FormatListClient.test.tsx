import {screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {describe, expect, it, vi} from 'vitest'

import FormatListClient from '@/components/podcast/FormatListClient'

vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

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
        renderWithLocale(<FormatListClient />)
        await waitFor(() => expect(screen.getByText('Interview')).toBeInTheDocument())
        expect(screen.getByRole('button', {name: /Neues Format/})).toHaveAttribute(
            'href', '/de/podcast/formats/new',
        )
    })
})
