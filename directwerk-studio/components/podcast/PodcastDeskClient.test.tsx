import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import PodcastDeskClient from '@/components/podcast/PodcastDeskClient'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/podcastApi', () => ({
    listSeries: vi.fn().mockResolvedValue([]),
    listFormats: vi.fn().mockResolvedValue([]),
    listEpisodes: vi.fn().mockResolvedValue([]),
}))

describe('PodcastDeskClient', () => {
    it('guides first-run setup toward creating a series', async () => {
        render(<PodcastDeskClient />)
        await waitFor(() =>
            expect(screen.getByRole('heading', {name: 'Inhalte erstellen'})).toBeInTheDocument(),
        )
        const seriesLinks = screen.getAllByRole('button', {name: 'Sendung anlegen'})
        expect(seriesLinks[0]).toHaveAttribute('href', '/podcast/series/new')
        expect(screen.getByText('So entsteht eine Folge')).toBeInTheDocument()
    })
})
