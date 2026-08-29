import {cleanup, render, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import RssImportWizard from '@/components/podcast/RssImportWizard'
import {MeProvider} from '@/lib/auth/MeProvider'
import type {Me, RssImportPreview, SeriesSummary} from '@directwerk/api/types'

const previewRssFeed = vi.fn()
const importRssEpisode = vi.fn()
const ingestRemoteAsset = vi.fn()
const createSeries = vi.fn()
const createFormat = vi.fn()
const listSeries = vi.fn()
const listFormats = vi.fn()

vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('next/link', () => ({
    default: ({children, href}: {children: React.ReactNode; href: string}) => (
        <a href={href}>{children}</a>
    ),
}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({
    useAuthRequired: () => () => false,
}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))
vi.mock('@/lib/api/podcastApi', () => ({
    listSeries: (...args: unknown[]) => listSeries(...args),
    createSeries: (...args: unknown[]) => createSeries(...args),
}))
vi.mock('@/lib/api/catalogApi', () => ({
    listFormats: (...args: unknown[]) => listFormats(...args),
    createFormat: (...args: unknown[]) => createFormat(...args),
}))
vi.mock('@/lib/api/podcastImportApi', () => ({
    previewRssFeed: (...args: unknown[]) => previewRssFeed(...args),
    importRssEpisode: (...args: unknown[]) => importRssEpisode(...args),
    ingestRemoteAsset: (...args: unknown[]) => ingestRemoteAsset(...args),
}))

const existingSeries: SeriesSummary = {
    id: 7,
    slug: 'alpha-show',
    title: 'Alpha Show',
    status: 'PUBLISHED',
    rssUrl: 'https://demo.example/feeds/demo/alpha-show.xml',
}

const preview: RssImportPreview = {
    feedUrl: 'https://cdn.example.com/feed.xml',
    channel: {
        title: 'Alpha Show',
        description: 'About the show',
        language: 'de',
        itunesCategory: 'News',
        imageUrl: 'https://cdn.example.com/show.jpg',
        link: 'https://example.com',
        suggestedSlug: 'alpha-show',
    },
    episodes: [
        {
            guid: 'guid-1',
            title: 'Folge 1',
            description: 'Notes 1',
            publishedAt: '2026-07-20T12:00:00Z',
            durationSeconds: 3600,
            episodeNumber: 1,
            audioUrl: 'https://cdn.example.com/ep1.mp3',
            audioMimeType: 'audio/mpeg',
            audioSizeBytes: 1_234_567,
            imageUrl: 'https://cdn.example.com/ep1.jpg',
            suggestedSlug: 'folge-1',
            alreadyImportedEpisodeId: null,
        },
        {
            guid: 'guid-2',
            title: 'Folge 2',
            description: 'Notes 2',
            publishedAt: '2026-07-21T12:00:00Z',
            durationSeconds: 1800,
            episodeNumber: 2,
            audioUrl: 'https://cdn.example.com/ep2.mp3',
            audioMimeType: 'audio/mpeg',
            audioSizeBytes: 800_000,
            imageUrl: null,
            suggestedSlug: 'folge-2',
            alreadyImportedEpisodeId: null,
        },
    ],
    truncated: false,
}

function adminMe(): Me {
    return {
        email: 'admin@example.com',
        name: 'Admin',
        roles: ['TENANT_ADMIN'],
        tenantId: 1,
    }
}

function editorMe(): Me {
    return {
        email: 'editor@example.com',
        name: 'Editor',
        roles: ['EDITOR'],
        tenantId: 1,
    }
}

function renderWizard(me: Me = adminMe()): void {
    render(
        <MeProvider me={me}>
            <RssImportWizard />
        </MeProvider>,
    )
}

async function loadFeed(): Promise<void> {
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('https://example.com/podcast.xml'), preview.feedUrl)
    await user.click(screen.getByRole('button', {name: 'Feed laden'}))
    await waitFor(() => expect(screen.getByText('Sendung festlegen')).toBeInTheDocument())
}

beforeEach(() => {
    listSeries.mockResolvedValue([existingSeries])
    listFormats.mockResolvedValue([
        {
            id: 3,
            slug: 'hauptfolge',
            name: 'Hauptfolge',
            active: true,
            description: null,
            requiredLevelSortOrder: null,
            sortOrder: 0,
            coverAssetId: null,
        },
    ])
    previewRssFeed.mockResolvedValue(preview)
    createSeries.mockResolvedValue({
        id: 8,
        slug: 'neue-sendung',
        title: 'Neue Sendung',
        status: 'DRAFT',
        rssUrl: null,
    })
    createFormat.mockResolvedValue({
        id: 4,
        slug: 'bonus',
        name: 'Bonus',
        active: true,
        description: null,
        requiredLevelSortOrder: null,
        sortOrder: 0,
        coverAssetId: null,
    })
    ingestRemoteAsset.mockResolvedValue({id: 99})
    importRssEpisode.mockResolvedValue({
        alreadyImported: false,
        episode: {
            id: 11,
            slug: 'folge-1',
            title: 'Folge 1',
            status: 'DRAFT',
            accessPolicy: 'FREE',
            publishedAt: null,
            seriesId: 7,
            seriesSlug: 'alpha-show',
            description: 'Notes 1',
            episodeNumber: 1,
            audioAssetId: 21,
            coverAssetId: 22,
            enclosureEnabled: true,
            requiredLevelSortOrder: null,
            scheduledAt: null,
            formats: [],
            categories: [],
        },
    })
})

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('RssImportWizard', () => {
    it('walks URL → sendung → formate → episode import → skip → done', async () => {
        const user = userEvent.setup()
        renderWizard()

        await waitFor(() => expect(listSeries).toHaveBeenCalled())
        expect(screen.getByText('Feed-Adresse')).toBeInTheDocument()

        await loadFeed()
        expect(previewRssFeed).toHaveBeenCalledWith('tenant.test', preview.feedUrl)
        expect(screen.getByText(/2 Folgen gefunden/)).toBeInTheDocument()

        await user.click(screen.getByRole('button', {name: 'Weiter zu Formaten'}))
        await waitFor(() => expect(screen.getByText('Formate zuordnen')).toBeInTheDocument())
        expect(createSeries).not.toHaveBeenCalled()
        expect(ingestRemoteAsset).not.toHaveBeenCalled()

        await user.click(screen.getByRole('checkbox', {name: 'Hauptfolge'}))
        await user.type(screen.getByPlaceholderText('z. B. Hauptfolge'), 'Bonus')
        await user.click(screen.getByRole('button', {name: 'Weiter zu den Folgen'}))

        await waitFor(() => expect(screen.getByText('Folge 1 von 2')).toBeInTheDocument())
        expect(createFormat).toHaveBeenCalledWith('tenant.test', {slug: 'bonus', name: 'Bonus'})
        expect(screen.getByDisplayValue('Folge 1')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', {name: 'MP3 nach S3 streamen'})).toBeChecked()

        await user.click(screen.getByRole('button', {name: 'Diese Folge importieren'}))
        await waitFor(() => expect(screen.getByText('Folge 2 von 2')).toBeInTheDocument())
        expect(importRssEpisode).toHaveBeenCalledWith(
            'tenant.test',
            expect.objectContaining({
                seriesId: 7,
                guid: 'guid-1',
                slug: 'folge-1',
                title: 'Folge 1',
                audioUrl: 'https://cdn.example.com/ep1.mp3',
                imageUrl: 'https://cdn.example.com/ep1.jpg',
                formatIds: expect.arrayContaining([3, 4]),
            }),
        )

        await user.click(screen.getByRole('button', {name: 'Überspringen'}))
        await waitFor(() => expect(screen.getByText('Import abgeschlossen')).toBeInTheDocument())
        expect(screen.getByText(/1 Folgen importiert, 1 übersprungen/)).toBeInTheDocument()
        expect(screen.getByRole('link', {name: 'Zur Folgenliste'})).toHaveAttribute(
            'href',
            '/podcast/episodes',
        )
    })

    it('streams a series cover when creating a new sendung', async () => {
        listSeries.mockResolvedValue([])
        const user = userEvent.setup()
        renderWizard()
        await loadFeed()

        expect(screen.getByDisplayValue('Alpha Show')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', {name: /Cover aus dem Feed nach S3 streamen/})).toBeChecked()

        await user.click(screen.getByRole('button', {name: 'Weiter zu Formaten'}))
        await waitFor(() => expect(screen.getByText('Formate zuordnen')).toBeInTheDocument())
        expect(ingestRemoteAsset).toHaveBeenCalledWith('tenant.test', {
            sourceUrl: 'https://cdn.example.com/show.jpg',
            assetType: 'IMAGE',
            visibility: 'PUBLIC',
            filename: 'series-cover.jpg',
        })
        expect(createSeries).toHaveBeenCalledWith(
            'tenant.test',
            expect.objectContaining({
                slug: 'alpha-show',
                title: 'Alpha Show',
                coverAssetId: 99,
            }),
        )
    })

    it('hides format creation for editors', async () => {
        const user = userEvent.setup()
        renderWizard(editorMe())
        await loadFeed()
        await user.click(screen.getByRole('button', {name: 'Weiter zu Formaten'}))
        await waitFor(() => expect(screen.getByText('Formate zuordnen')).toBeInTheDocument())
        expect(screen.queryByPlaceholderText('z. B. Hauptfolge')).not.toBeInTheDocument()
        expect(screen.getByText(/Neue Formate kann nur ein Tenant-Admin anlegen/)).toBeInTheDocument()
    })

    it('resets the wizard so another feed can be imported', async () => {
        const user = userEvent.setup()
        renderWizard()
        await loadFeed()
        await user.click(screen.getByRole('button', {name: 'Weiter zu Formaten'}))
        await waitFor(() => expect(screen.getByText('Formate zuordnen')).toBeInTheDocument())
        await user.click(screen.getByRole('button', {name: 'Weiter zu den Folgen'}))
        await waitFor(() => expect(screen.getByText('Folge 1 von 2')).toBeInTheDocument())
        await user.click(screen.getByRole('button', {name: 'Überspringen'}))
        await user.click(screen.getByRole('button', {name: 'Überspringen'}))
        await waitFor(() => expect(screen.getByText('Import abgeschlossen')).toBeInTheDocument())

        await user.click(screen.getByRole('button', {name: 'Weiteren Feed importieren'}))
        expect(screen.getByText('Feed-Adresse')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('https://example.com/podcast.xml')).toHaveValue('')
    })
})
