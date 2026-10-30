import {cleanup, fireEvent, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import WorkspaceChooser from '@/components/studio/WorkspaceChooser'
import type {StudioWorkspace} from '@directwerk/api/types'
import {renderWithLocale} from '@/lib/i18n/testUtils'

const workspaces: StudioWorkspace[] = [
    {
        tenantId: 1,
        slug: 'alpha-a',
        name: 'Alpha Podcast',
        host: 'alpha-a.localhost',
        faviconUrl: 'https://cdn.example.test/alpha-favicon.ico',
        logoUrl: 'https://cdn.example.test/alpha-logo.png',
    },
    {
        tenantId: 2,
        slug: 'beta-b',
        name: 'Beta Show',
        host: 'beta-b.localhost',
        faviconUrl: null,
        logoUrl: 'https://cdn.example.test/beta-logo.png',
    },
    {
        tenantId: 3,
        slug: 'gamma-c',
        name: 'Gamma Cast',
        host: 'gamma-c.localhost',
        faviconUrl: null,
        logoUrl: null,
    },
]

function renderChooser(overrides?: {
    workspaces?: StudioWorkspace[]
    openingHost?: string | null
    error?: string | null
    onSelect?: (workspace: StudioWorkspace) => void
    onBack?: () => void
}) {
    const onSelect = overrides?.onSelect ?? vi.fn()
    const onBack = overrides?.onBack ?? vi.fn()
    renderWithLocale(
        <WorkspaceChooser
            error={overrides?.error ?? null}
            onBack={onBack}
            onSelect={onSelect}
            openingHost={overrides?.openingHost ?? null}
            workspaces={overrides?.workspaces ?? workspaces}
        />,
    )
    return {onSelect, onBack}
}

afterEach(() => {
    cleanup()
})

describe('WorkspaceChooser', () => {
    it('renders every workspace with name and host', () => {
        renderChooser()

        expect(
            screen.getByRole('button', {name: 'Alpha Podcast (alpha-a.localhost) öffnen'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'Beta Show (beta-b.localhost) öffnen'}),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'Gamma Cast (gamma-c.localhost) öffnen'}),
        ).toBeInTheDocument()
    })

    it('prefers favicon over logo for the workspace avatar', () => {
        renderChooser({workspaces: [workspaces[0]]})

        const avatar = screen.getByRole('button', {
            name: 'Alpha Podcast (alpha-a.localhost) öffnen',
        }).querySelector('img')

        expect(avatar).toHaveAttribute('src', 'https://cdn.example.test/alpha-favicon.ico')
    })

    it('falls back to logo when favicon is missing', () => {
        renderChooser({workspaces: [workspaces[1]]})

        const avatar = screen.getByRole('button', {
            name: 'Beta Show (beta-b.localhost) öffnen',
        }).querySelector('img')

        expect(avatar).toHaveAttribute('src', 'https://cdn.example.test/beta-logo.png')
    })

    it('falls back to the tenant initial when no branding image is available', () => {
        renderChooser({workspaces: [workspaces[2]]})

        const button = screen.getByRole('button', {
            name: 'Gamma Cast (gamma-c.localhost) öffnen',
        })

        expect(button.querySelector('img')).toBeNull()
        expect(button).toHaveTextContent('G')
    })

    it('selects the clicked workspace', () => {
        const {onSelect} = renderChooser()

        fireEvent.click(
            screen.getByRole('button', {name: 'Beta Show (beta-b.localhost) öffnen'}),
        )

        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenCalledWith(workspaces[1])
    })

    it('marks only the opening workspace busy and disables the rest', () => {
        renderChooser({openingHost: 'alpha-a.localhost'})

        expect(screen.getByText('Wird geöffnet…')).toBeInTheDocument()
        expect(
            screen.getByRole('button', {name: 'Alpha Podcast (alpha-a.localhost) öffnen'}),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', {name: 'Beta Show (beta-b.localhost) öffnen'}),
        ).toBeDisabled()
        expect(screen.getByRole('button', {name: 'Zurück'})).toBeDisabled()
    })

    it('shows the error and returns via the back button', () => {
        const {onBack} = renderChooser({error: 'Anmeldung fehlgeschlagen.'})

        expect(screen.getByText('Anmeldung fehlgeschlagen.')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', {name: 'Zurück'}))

        expect(onBack).toHaveBeenCalledTimes(1)
    })
})
