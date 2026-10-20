import {cleanup, render, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

const listMediaMock = vi.fn()

vi.mock('@/lib/api/mediaApi', () => ({
    listMedia: (...args: unknown[]) => listMediaMock(...args),
}))

// Base UI's select renders a button + portal, not native <option>s; render the picker's own
// option children directly so the offered ids are inspectable.
vi.mock('@/components/studio/SelectControl', () => ({
    default: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}))

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import type {MediaAsset} from '@directwerk/api/types'

function asset(overrides: Partial<MediaAsset> & {id: number; title: string}): MediaAsset {
    return {
        assetType: 'IMAGE',
        status: 'READY',
        visibility: 'PUBLIC',
        cdnUrl: 'https://cdn.example.test/a.jpg',
        ...overrides,
    } as MediaAsset
}

/** The picker's own `<option>` children are the selectable asset ids. */
function offeredIds(): string[] {
    return Array.from(document.querySelectorAll('option'))
        .map((option) => option.value)
        .filter((value) => value !== '')
}

afterEach(() => {
    cleanup()
    listMediaMock.mockReset()
})

describe('media library picker visibility (#553)', () => {
    it('cannot offer a PRIVATE image to a public cover field', async () => {
        listMediaMock.mockResolvedValue([
            asset({id: 1, title: 'Public cover'}),
            asset({id: 2, title: 'Private cover', visibility: 'PRIVATE', cdnUrl: null as never}),
        ])

        render(
            <MediaLibraryPicker
                assetType="IMAGE"
                label="Titelbild aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={() => {}}
                requirePublic
                selectedId={null}
            />,
        )

        await waitFor(() => expect(offeredIds()).toEqual(['1']))
    })

    it('still lists private files for non-public fields', async () => {
        listMediaMock.mockResolvedValue([
            asset({id: 2, title: 'Private audio', assetType: 'AUDIO', visibility: 'PRIVATE'}),
        ])

        render(
            <MediaLibraryPicker
                assetType="AUDIO"
                label="Audio aus Mediathek"
                onAuthRequired={() => {}}
                onSelect={() => {}}
                selectedId={null}
            />,
        )

        await waitFor(() => expect(offeredIds()).toEqual(['2']))
    })
})
