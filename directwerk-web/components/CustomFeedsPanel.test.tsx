import {cleanup, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import CustomFeedsPanel from '@/components/CustomFeedsPanel'
import type {SubscriberFeed} from '@directwerk/api/types'

const listPublicFormatsMock = vi.fn()
const previewCustomFeedMock = vi.fn()

vi.mock('@/lib/api/client', () => ({
    listPublicFormats: (...args: unknown[]) => listPublicFormatsMock(...args),
    previewCustomFeed: (...args: unknown[]) => previewCustomFeedMock(...args),
    createCustomFeed: vi.fn(),
    updateCustomFeed: vi.fn(),
    setFeedEnabled: vi.fn(),
    rotateFeedToken: vi.fn(),
    deleteCustomFeed: vi.fn(),
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

function feed(overrides: Partial<SubscriberFeed> = {}): SubscriberFeed {
    return {
        id: 1,
        title: 'Default',
        isDefault: true,
        enabled: true,
        url: 'http://alpha-a.localhost:8080/feeds/alpha-show-a/u/tok.xml',
        formatIds: [],
        formats: [],
        createdAt: '2026-07-22T12:00:00Z',
        updatedAt: '2026-07-22T12:00:00Z',
        ...overrides,
    }
}

describe('CustomFeedsPanel', () => {
    it('shows the create form when feed builder is enabled', async () => {
        listPublicFormatsMock.mockResolvedValue([
            {
                id: 3,
                slug: 'interview',
                name: 'Interview',
                description: null,
                requiredLevelSortOrder: null,
                sortOrder: 1,
            },
        ])
        previewCustomFeedMock.mockResolvedValue({episodeCount: 0, sampleTitles: []})

        render(
            <CustomFeedsPanel
                canBuild
                feeds={[feed()]}
                onAuthRequired={() => undefined}
                onError={() => undefined}
                onFeedsChange={() => undefined}
                tenantHost="alpha-a.localhost"
            />,
        )

        await waitFor(() =>
            expect(screen.getByText('Neuen Feed anlegen')).toBeInTheDocument(),
        )
        expect(screen.getByText('Interview')).toBeInTheDocument()
        expect(screen.getByText('Noch keine eigenen Feeds.')).toBeInTheDocument()
    })

    it('lists leftover custom feeds without the create form when the module is off', async () => {
        listPublicFormatsMock.mockResolvedValue([])

        render(
            <CustomFeedsPanel
                canBuild={false}
                feeds={[
                    feed(),
                    feed({
                        id: 9,
                        title: 'Nur Interviews',
                        isDefault: false,
                        formatIds: [3],
                        formats: [
                            {
                                id: 3,
                                slug: 'interview',
                                name: 'Interview',
                                requiredLevelSortOrder: null,
                                sortOrder: 1,
                            },
                        ],
                    }),
                ]}
                onAuthRequired={() => undefined}
                onError={() => undefined}
                onFeedsChange={() => undefined}
                tenantHost="alpha-a.localhost"
            />,
        )

        await waitFor(() =>
            expect(screen.getByText('Nur Interviews')).toBeInTheDocument(),
        )
        expect(screen.queryByText('Neuen Feed anlegen')).not.toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Deaktivieren'})).toBeInTheDocument()
        expect(screen.getByRole('button', {name: 'Löschen'})).toBeInTheDocument()
    })
})
