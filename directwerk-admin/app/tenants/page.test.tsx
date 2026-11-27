import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/api/client', () => ({getPlatformTenantsPage: vi.fn()}))
vi.mock('@/lib/api/usePlatformQuery', () => ({
    usePlatformQuery: () => ({
        data: {content: [], page: 0, size: 25, totalElements: 0},
        error: null,
        isLoading: false,
        reload: vi.fn(),
    }),
}))

import TenantsPage from './page'

describe('tenants page', () => {
    it('keeps search and the create-first empty state on an empty result', () => {
        render(<TenantsPage />)

        // The page-level gate used to hide the table when the list was empty, so a search hit
        // zero and the search box disappeared with it.
        expect(screen.getByPlaceholderText('Name, slug, or domain')).toBeInTheDocument()
        expect(screen.getByText('No tenants yet')).toBeInTheDocument()
    })
})
