import {cleanup, render, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, describe, expect, it, vi} from 'vitest'

import EpisodeEditor from '@/components/podcast/EpisodeEditor'

// `useRouter()` in Next.js returns a stable/memoized object across re-renders.
// The load effect depends on `router` (see EpisodeEditor.tsx), so the mock must
// return the same object reference on every call, or an unstable mock would
// re-trigger that effect on every render and reset in-progress tag selections.
const mockRouter = {replace: vi.fn()}
vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@/lib/tenant/getClientTenantHost', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({
    useSiteConfig: () => ({
        enabledModules: ['DIGITAL_CONTENT'],
        publicSiteUrl: 'https://demo.example',
        publicRssUrl: 'https://demo.example/feeds/demo/podcast.xml',
        emailNotifyAvailable: false,
    }),
}))

const draftEpisode = {
    id: 1,
    slug: 'ep-1',
    title: 'Episode',
    status: 'DRAFT',
    accessPolicy: 'FREE',
    publishedAt: null,
    seriesId: 1,
    seriesSlug: 'show',
    description: 'Shownotes',
    episodeNumber: null,
    audioAssetId: 10,
    enclosureEnabled: true,
    requiredLevelSortOrder: null,
    scheduledAt: null,
    formats: [] as Array<{id: number; slug: string; name: string}>,
    categories: [] as Array<{id: number; slug: string; name: string}>,
}

const getEpisode = vi.fn().mockImplementation(async () => ({...draftEpisode}))
const listPublicLevels = vi.fn().mockResolvedValue([
    {id: 1, slug: 'fan', title: 'Fan', sortOrder: 10},
    {id: 2, slug: 'supporter', title: 'Supporter', sortOrder: 20},
])

const replaceEpisodeFormats = vi.fn().mockResolvedValue({
    ...draftEpisode,
    formats: [{id: 1, slug: 'interview', name: 'Interview'}],
})
const replaceEpisodeCategories = vi.fn().mockResolvedValue({
    ...draftEpisode,
    formats: [{id: 1, slug: 'interview', name: 'Interview'}],
})
const updateEpisode = vi.fn().mockResolvedValue(draftEpisode)
const publishEpisode = vi.fn().mockResolvedValue({
    ...draftEpisode,
    status: 'PUBLISHED',
    formats: [{id: 1, slug: 'interview', name: 'Interview'}],
})

vi.mock('@/lib/api/podcastApi', () => ({
    listSeries: vi.fn().mockResolvedValue([
        {id: 1, slug: 'show', title: 'Show', status: 'PUBLISHED', rssUrl: 'https://demo.example/feeds/demo/show.xml'},
    ]),
    getEpisode: (...args: unknown[]) => getEpisode(...args),
    listEpisodes: vi.fn().mockResolvedValue([]),
    replaceEpisodeFormats: (...args: unknown[]) => replaceEpisodeFormats(...args),
    replaceEpisodeCategories: (...args: unknown[]) => replaceEpisodeCategories(...args),
    updateEpisode: (...args: unknown[]) => updateEpisode(...args),
    publishEpisode: (...args: unknown[]) => publishEpisode(...args),
}))
vi.mock('@/lib/api/subscriptionApi', () => ({
    listPublicLevels: (...args: unknown[]) => listPublicLevels(...args),
}))
vi.mock('@/lib/api/catalogApi', () => ({
    listFormats: vi.fn().mockResolvedValue([
        {id: 1, slug: 'interview', name: 'Interview', active: true, description: null, requiredLevelSortOrder: null, sortOrder: 0},
    ]),
    listCategories: vi.fn().mockResolvedValue([]),
    replaceEpisodeFormats: (...args: unknown[]) => replaceEpisodeFormats(...args),
    replaceEpisodeCategories: (...args: unknown[]) => replaceEpisodeCategories(...args),
}))
vi.mock('@/lib/api/mediaApi', () => ({
    getMedia: vi.fn().mockResolvedValue({
        id: 10,
        status: 'READY',
        assetType: 'AUDIO',
        mimeType: 'audio/mpeg',
        originalFilename: 'folge.mp3',
        sizeBytes: 1024,
    }),
    getMediaPreviewUrl: vi.fn().mockResolvedValue('https://cdn.example/preview.mp3'),
}))

afterEach(() => {
    cleanup()
})

describe('EpisodeEditor tagging', () => {
    it('renders Mindest-Stufe as a dropdown with an explanatory hint', async () => {
        render(<EpisodeEditor episodeId={1} />)

        await waitFor(() =>
            expect(
                screen.getByText(/Niedrigste Stufe, die Zugriff erhält/),
            ).toBeInTheDocument(),
        )
        expect(
            screen.getByText(/Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist/),
        ).toBeInTheDocument()
        expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0)
    })

    it('disables Mindest-Stufe for free episodes', async () => {
        render(<EpisodeEditor episodeId={1} />)

        await waitFor(() => expect(screen.getByRole('combobox')).toBeDisabled())
        expect(
            screen.getByText(/Nur relevant für kostenpflichtige Inhalte/),
        ).toBeInTheDocument()
    })

    it('offers the level catalog when the episode is paid', async () => {
        getEpisode.mockResolvedValueOnce({...draftEpisode, accessPolicy: 'PAID'})
        render(<EpisodeEditor episodeId={1} />)

        expect(
            await screen.findByRole('option', {name: 'Öffentlich / Keine Mindeststufe'}),
        ).toBeInTheDocument()
        expect(screen.getByRole('option', {name: 'Fan (10)'})).toBeInTheDocument()
        expect(screen.getByRole('option', {name: 'Supporter (20)'})).toBeInTheDocument()
    })

    it('saves selected formats and categories', async () => {
        const user = userEvent.setup()
        render(<EpisodeEditor episodeId={1} />)

        await waitFor(() => expect(screen.getByLabelText('Interview')).toBeInTheDocument())
        await user.click(screen.getByLabelText('Interview'))
        await user.click(screen.getByRole('button', {name: 'Speichern'}))

        await waitFor(() => expect(replaceEpisodeFormats).toHaveBeenCalledWith('tenant.test', 1, [1]))
        expect(replaceEpisodeCategories).toHaveBeenCalledWith('tenant.test', 1, [])
    })

    it('persists formats when publishing', async () => {
        const user = userEvent.setup()
        render(<EpisodeEditor episodeId={1} />)

        await waitFor(() => expect(screen.getByLabelText('Interview')).toBeInTheDocument())
        await user.click(screen.getByLabelText('Interview'))
        await waitFor(() =>
            expect(screen.getAllByRole('button', {name: 'Veröffentlichen'})[0]).toBeEnabled(),
        )
        await user.click(screen.getAllByRole('button', {name: 'Veröffentlichen'})[0])
        const dialog = await screen.findByRole('dialog')
        await user.click(within(dialog).getByRole('button', {name: 'Veröffentlichen'}))

        await waitFor(() => expect(replaceEpisodeFormats).toHaveBeenCalledWith('tenant.test', 1, [1]))
        expect(publishEpisode).toHaveBeenCalledWith('tenant.test', 1, {notifySubscribers: false})
    })
})
