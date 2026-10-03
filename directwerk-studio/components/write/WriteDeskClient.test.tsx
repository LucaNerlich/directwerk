import {screen, waitFor} from '@testing-library/react'
import {renderWithLocale} from '@/lib/i18n/testUtils'
import {describe, expect, it, vi} from 'vitest'

import WriteDeskClient from '@/components/write/WriteDeskClient'

vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/writeApi', () => ({
    listArticles: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
}))

describe('WriteDeskClient', () => {
    it('guides first-run setup toward creating an article', async () => {
        renderWithLocale(<WriteDeskClient />)
        await waitFor(() =>
            expect(screen.getByRole('heading', {name: 'Inhalte erstellen'})).toBeInTheDocument(),
        )
        expect(screen.getByText('So entsteht ein Beitrag')).toBeInTheDocument()
        expect(screen.getAllByRole('button', {name: 'Neuer Beitrag'})[0]).toHaveAttribute(
            'href', '/de/write/articles/new',
        )
    })
})
