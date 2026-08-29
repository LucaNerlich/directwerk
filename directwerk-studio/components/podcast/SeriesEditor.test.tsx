import {render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import SeriesEditor from '@/components/podcast/SeriesEditor'
import {clearCachedTenantData} from '@directwerk/api/client/useCachedTenantQuery'

// `useRouter()` in Next.js returns a stable/memoized object across re-renders.
// The load effect depends on `router` (see SeriesEditor.tsx), so the mock must
// return the same object reference on every call, or an unstable mock would
// re-trigger that effect on every render.
const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/podcastApi', () => ({
    getSeries: vi.fn().mockResolvedValue({
        id: 1, slug: 'show', title: 'Show', description: null, coverAssetId: null,
        language: 'de', itunesCategory: null, defaultRequiredLevelSortOrder: null,
        rssUrl: 'http://localhost:8080/feeds/tenant/show.xml', status: 'DRAFT',
    }),
    createSeries: vi.fn(),
    updateSeries: vi.fn(),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listPublicLevels: vi.fn().mockResolvedValue([
        {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
        {id: 2, slug: 'supporter', title: 'Supporter', sortOrder: 20},
    ]),
}))
vi.mock('@/lib/api/mediaApi', () => ({
    getMediaPreviewUrl: vi.fn(),
}))
vi.mock('@/lib/media/upload', () => ({uploadMediaFile: vi.fn()}))

describe('SeriesEditor RSS URL', () => {
    beforeEach(() => {
        clearCachedTenantData('public-levels', 'tenant.test')
    })

    it('renders Mindest-Stufe label and hint', async () => {
        render(<SeriesEditor seriesId={1} />)

        await waitFor(() =>
            expect(screen.getByLabelText(/Mindest-Stufe für Folgen \(Standard\)/)).toBeInTheDocument(),
        )
        expect(
            screen.getByText(/Standard-Mindest-Stufe für neue Folgen dieser Sendung/),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist/),
        ).toBeInTheDocument()
    })

    it('offers the level catalog in the Mindest-Stufe dropdown', async () => {
        render(<SeriesEditor seriesId={1} />)

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

    it('shows the series RSS feed URL when present', async () => {
        render(<SeriesEditor seriesId={1} />)
        await waitFor(() =>
            expect(screen.getByRole('link', {name: 'Öffnen'})).toHaveAttribute(
                'href',
                'http://localhost:8080/feeds/tenant/show.xml',
            ),
        )
        expect(screen.getByRole('button', {name: 'Sendung veröffentlichen'})).toBeInTheDocument()
        expect(screen.getByText('iTunes-Kategorie')).toBeInTheDocument()
    })
})
