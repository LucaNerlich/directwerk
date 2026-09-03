import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'

import CopyUrlButton from './CopyUrlButton'

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

describe('CopyUrlButton', () => {
    it('removes the fallback textarea when selecting it throws', async () => {
        vi.spyOn(HTMLTextAreaElement.prototype, 'select').mockImplementation(() => {
            throw new Error('selection failed')
        })

        render(<CopyUrlButton url="https://tenant.example/feed.xml" />)
        fireEvent.click(screen.getByRole('button', {name: 'Kopieren'}))

        await waitFor(() =>
            expect(screen.getByText(/Kopieren fehlgeschlagen/)).toBeInTheDocument(),
        )
        expect(document.querySelector('textarea')).toBeNull()
    })
})
