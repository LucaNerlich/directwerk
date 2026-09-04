import {render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {beforeEach, describe, expect, it, vi} from 'vitest'

import SeriesEditor from '@/components/podcast/SeriesEditor'
import {createSeries, updateSeries} from '@/lib/api/podcastApi'
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
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
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
    listMedia: vi.fn().mockResolvedValue([]),
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

    it('retries a failed publish-on-create as an update instead of duplicating', async () => {
        const created = {
            id: 9, slug: 'neue-sendung', title: 'Neue Sendung', description: null,
            coverAssetId: null, language: 'de', itunesCategory: null,
            itunesExplicit: false, defaultRequiredLevelSortOrder: null,
            rssUrl: null, status: 'DRAFT' as const,
            createdBy: null,
        }
        vi.mocked(createSeries).mockResolvedValueOnce(created)
        vi.mocked(updateSeries)
            .mockRejectedValueOnce(new Error('Veröffentlichung fehlgeschlagen.'))
            .mockResolvedValueOnce({...created, status: 'PUBLISHED' as const})

        const user = userEvent.setup()
        render(<SeriesEditor />)

        await user.type(screen.getByLabelText('Titel'), 'Neue Sendung')
        await user.click(screen.getByRole('checkbox', {name: 'Sendung sofort veröffentlichen'}))
        await user.click(screen.getByRole('button', {name: 'Sendung anlegen'}))

        await waitFor(() =>
            expect(screen.getByRole('alert')).toHaveTextContent(
                'Veröffentlichung fehlgeschlagen.',
            ),
        )
        expect(createSeries).toHaveBeenCalledTimes(1)
        // Still editing the created series — not a fresh "new" form.
        expect(screen.getByRole('button', {name: 'Speichern'})).toBeInTheDocument()

        await user.click(screen.getByRole('button', {name: 'Speichern'}))

        await waitFor(() => expect(updateSeries).toHaveBeenCalledTimes(2))
        expect(createSeries).toHaveBeenCalledTimes(1)
    })
})
