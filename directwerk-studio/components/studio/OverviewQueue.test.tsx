import {cleanup, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import OverviewQueue from '@/components/studio/OverviewQueue'
import {renderWithLocale} from '@/lib/i18n/testUtils'

const mockRouter = {replace: vi.fn()}
vi.mock('next/link', () => ({
    default: ({children, href, ...props}: {children?: React.ReactNode; href: string; [key: string]: unknown}) => (
        <a href={href} {...props}>{children}</a>
    ),
}))

vi.mock('next/navigation', () => ({useRouter: () => mockRouter}))
vi.mock('@directwerk/api/tenant', () => ({getClientTenantHost: () => 'tenant.test'}))

const listArticlesMock = vi.fn()
const listEpisodesMock = vi.fn()
const listSeriesMock = vi.fn()

vi.mock('@/lib/api/writeApi', () => ({
    listArticles: (...args: unknown[]) => listArticlesMock(...args),
}))
vi.mock('@/lib/api/podcastApi', () => ({
    listEpisodes: (...args: unknown[]) => listEpisodesMock(...args),
    listSeries: (...args: unknown[]) => listSeriesMock(...args),
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('OverviewQueue', () => {
    it('shows first-series empty state and draft queues', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([])
        listSeriesMock.mockResolvedValue([])

        renderWithLocale(<OverviewQueue desks={['WRITE', 'PODCAST']} />)

        await waitFor(() =>
            expect(screen.getByRole('link', {name: 'Erste Sendung anlegen'})).toHaveAttribute(
                'href',
                '/de/podcast/series/new',
            ),
        )
        expect(screen.getByRole('link', {name: 'Ersten Beitrag schreiben'})).toHaveAttribute(
            'href',
            '/de/write/articles/new',
        )
        expect(screen.queryByRole('link', {name: 'Erste Folge anlegen'})).not.toBeInTheDocument()
    })

    it('lists draft episodes and series awaiting publish', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([
            {
                id: 9,
                slug: 'draft-ep',
                title: 'Unveröffentlichte Folge',
                status: 'DRAFT',
                accessPolicy: 'FREE',
                publishedAt: null,
            },
        ])
        listSeriesMock.mockResolvedValue([
            {id: 3, slug: 'show', title: 'Entwurfs-Sendung', status: 'DRAFT', rssUrl: null},
        ])

        renderWithLocale(<OverviewQueue desks={['PODCAST']} />)

        await waitFor(() =>
            expect(screen.getByRole('link', {name: /Entwurfs-Sendung/})).toHaveAttribute(
                'href',
                '/de/podcast/series/3',
            ),
        )
        expect(screen.getByRole('link', {name: /Unveröffentlichte Folge/})).toHaveAttribute(
            'href',
            '/de/podcast/episodes/9',
        )
        expect(screen.getAllByRole('button', {name: 'Raster'})).toHaveLength(1)
    })

    it('prompts for the first episode once a series exists', async () => {
        listArticlesMock.mockResolvedValue([])
        listEpisodesMock.mockResolvedValue([])
        listSeriesMock.mockResolvedValue([
            {
                id: 1,
                slug: 'show',
                title: 'Show',
                status: 'PUBLISHED',
                rssUrl: 'https://demo.example/feeds/demo/show.xml',
            },
        ])

        renderWithLocale(<OverviewQueue desks={['PODCAST']} />)

        await waitFor(() =>
            expect(screen.getByRole('link', {name: 'Erste Folge anlegen'})).toHaveAttribute(
                'href',
                '/de/podcast/episodes/new',
            ),
        )
    })
})
