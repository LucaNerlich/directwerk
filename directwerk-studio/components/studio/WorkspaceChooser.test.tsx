import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import WorkspaceChooser from '@/components/studio/WorkspaceChooser'
import type {StudioWorkspace} from '@directwerk/api/types'

const workspaces: StudioWorkspace[] = [
    {tenantId: 1, slug: 'alpha-a', name: 'Alpha Podcast', host: 'alpha-a.localhost'},
    {tenantId: 2, slug: 'beta-b', name: 'Beta Show', host: 'beta-b.localhost'},
]

function renderChooser(overrides?: {
    openingHost?: string | null
    error?: string | null
    onSelect?: (workspace: StudioWorkspace) => void
    onBack?: () => void
}) {
    const onSelect = overrides?.onSelect ?? vi.fn()
    const onBack = overrides?.onBack ?? vi.fn()
    render(
        <WorkspaceChooser
            error={overrides?.error ?? null}
            onBack={onBack}
            onSelect={onSelect}
            openingHost={overrides?.openingHost ?? null}
            workspaces={workspaces}
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
