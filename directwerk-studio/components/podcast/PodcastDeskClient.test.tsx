import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import PodcastDeskClient from '@/components/podcast/PodcastDeskClient'
import {listEpisodes, listSeries} from '@/lib/api/podcastApi'
import {listFormats} from '@/lib/api/catalogApi'

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/podcastApi', () => ({
    listSeries: vi.fn().mockResolvedValue([]),
    listEpisodes: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/api/catalogApi', () => ({
    listFormats: vi.fn().mockResolvedValue([]),
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

    it('offers RSS import once a sendung exists', async () => {
        vi.mocked(listSeries).mockResolvedValueOnce([
            {
                id: 1,
                slug: 'show',
                title: 'Show',
                status: 'PUBLISHED',
                rssUrl: null,
            },
        ])
        vi.mocked(listFormats).mockResolvedValueOnce([])
        vi.mocked(listEpisodes).mockResolvedValueOnce([])

        render(<PodcastDeskClient />)
        await waitFor(() =>
            expect(screen.getByRole('button', {name: 'RSS importieren'})).toHaveAttribute(
                'href',
                '/podcast/import',
            ),
        )
    })
})
