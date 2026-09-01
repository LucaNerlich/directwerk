import {render, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import ShowNotesEditor from '@/components/editors/ShowNotesEditor'

describe('ShowNotesEditor', () => {
    it('does not report a content change when mounted or disabled', async () => {
        const onChange = vi.fn()
        const {container, rerender} = render(
            <ShowNotesEditor onChange={onChange} value="<p>Draft</p>" />,
        )

        const editor = await waitFor(() => {
            const element = container.querySelector('.ProseMirror')
            expect(element).toHaveAttribute('contenteditable', 'true')
            return element
        })
        expect(onChange).not.toHaveBeenCalled()

        rerender(
            <ShowNotesEditor disabled onChange={onChange} value="<p>Draft</p>" />,
        )

        await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'false'))

        rerender(
            <ShowNotesEditor onChange={onChange} value="<p>Draft</p>" />,
        )

        await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'))
        expect(onChange).not.toHaveBeenCalled()
    })
})
