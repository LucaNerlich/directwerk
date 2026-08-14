import {render, screen, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import SeriesEditor from '@/components/podcast/SeriesEditor'

// `useRouter()` in Next.js returns a stable/memoized object across re-renders.
// The load effect depends on `router` (see SeriesEditor.tsx), so the mock must
// return the same object reference on every call, or an unstable mock would
// re-trigger that effect on every render.
const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/tenantApi', () => ({
    getSeries: vi.fn().mockResolvedValue({
        id: 1, slug: 'show', title: 'Show', description: null, coverAssetId: null,
        language: 'de', itunesCategory: null, defaultRequiredLevelSortOrder: null,
        rssUrl: 'http://localhost:8080/feeds/tenant/show.xml', status: 'DRAFT',
    }),
    createSeries: vi.fn(),
    updateSeries: vi.fn(),
    getMediaPreviewUrl: vi.fn(),
    listMedia: vi.fn().mockResolvedValue([]),
    suggestSlug: (title: string) => title.toLowerCase(),
}))
vi.mock('@/lib/media/upload', () => ({uploadMediaFile: vi.fn()}))

describe('SeriesEditor RSS URL', () => {
    it('renders Mindest-Stufe label and hint', async () => {
        render(<SeriesEditor seriesId={1} />)

        await waitFor(() =>
            expect(screen.getByLabelText(/Mindest-Stufe für Folgen \(Standard\)/)).toBeInTheDocument(),
        )
        expect(
            screen.getByText(/Standard-Mindest-Stufe \(Sortierzahl\) für neue Folgen dieser Sendung/),
        ).toBeInTheDocument()
        expect(
            screen.getByText(/Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist/),
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
