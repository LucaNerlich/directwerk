import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import LoadingState from './loading-state'

describe('LoadingState', () => {
    it('announces the message in a status region with hidden skeleton art', () => {
        render(<LoadingState lines={2} message="Beiträge werden geladen…" />)

        const status = screen.getByRole('status')
        expect(status).toHaveTextContent('Beiträge werden geladen…')
        expect(
            status.querySelector('[aria-hidden="true"]'),
        ).toBeInTheDocument()
    })

    it('renders at least one skeleton bar by default', () => {
        const {container} = render(<LoadingState message="Wird geladen…" />)

        expect(
            container.querySelectorAll('[data-slot="skeleton"]').length,
        ).toBeGreaterThan(0)
    })
})
