import {render, screen} from '@testing-library/react'
import {describe, expect, it} from 'vitest'

import {Progress} from './progress'

describe('Progress', () => {
    it('exposes its value via aria-valuenow', () => {
        render(<Progress value={42} />)

        const bar = screen.getByRole('progressbar')
        expect(bar).toHaveAttribute('aria-valuemin', '0')
        expect(bar).toHaveAttribute('aria-valuemax', '100')
        expect(bar).toHaveAttribute('aria-valuenow', '42')
    })

    it('clamps values outside the 0–100 range', () => {
        render(<Progress value={140} />)
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    })

    it('forwards aria-label to the progressbar', () => {
        render(<Progress value={42} aria-label="Upload progress" />)
        expect(screen.getByRole('progressbar')).toHaveAttribute(
            'aria-label',
            'Upload progress',
        )
    })

    it('forwards aria-labelledby to the progressbar', () => {
        render(<Progress value={42} aria-labelledby="file-name" />)
        expect(screen.getByRole('progressbar')).toHaveAttribute(
            'aria-labelledby',
            'file-name',
        )
    })
})
