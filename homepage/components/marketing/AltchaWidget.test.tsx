import {cleanup, render, screen} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

vi.mock('altcha', () => {
    throw new Error('chunk failed to load')
})

import AltchaWidget from './AltchaWidget'

afterEach(cleanup)

describe('AltchaWidget', () => {
    it('shows the caller-provided failure label when the chunk cannot load', async () => {
        render(<AltchaWidget failureLabel="The security widget could not be loaded." />)

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'The security widget could not be loaded.',
        )
        expect(screen.queryByText(/Sicherheits-Widget/)).not.toBeInTheDocument()
    })
})
