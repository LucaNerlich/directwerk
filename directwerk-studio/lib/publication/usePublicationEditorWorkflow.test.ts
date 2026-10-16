import {act, renderHook, waitFor} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'

import {usePublicationEditorWorkflow} from '@/lib/publication/usePublicationEditorWorkflow'

type Draft = {id: number; status: 'DRAFT'}

const draft: Draft = {id: 1, status: 'DRAFT'}

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((r) => {
        resolve = r
    })
    return {promise, resolve}
}

describe('usePublicationEditorWorkflow autosave (#557)', () => {
    it('keeps the dirty flag when an edit lands during an in-flight save', async () => {
        // The editor used to clear isDirty unconditionally on success, so a keystroke typed while
        // the PUT was in flight was never sent AND the autosave effect could not re-arm — the
        // editor reported "Automatisch gespeichert" while the last edit was lost.
        const gate = deferred<Draft>()
        const saveImpl = vi.fn().mockReturnValue(gate.promise)

        const {result} = renderHook(() =>
            usePublicationEditorWorkflow<Draft>({
                publicationId: 1,
                publication: draft,
                saveImpl,
                authRedirect: () => false,
            }),
        )

        act(() => {
            result.current.markDirty()
        })
        expect(result.current.isDirty).toBe(true)

        let pending: Promise<Draft | null> | undefined
        act(() => {
            pending = result.current.save({autosave: true})
        })

        // the user keeps typing while the request is on the wire
        act(() => {
            result.current.markDirty()
        })

        await act(async () => {
            gate.resolve(draft)
            await pending
        })

        await waitFor(() => expect(result.current.isSaving).toBe(false))
        expect(result.current.isDirty).toBe(true)
        expect(result.current.saveHint).not.toBe('Automatisch gespeichert')
    })

    it('clears the dirty flag when nothing changed during the save', async () => {
        const saveImpl = vi.fn().mockResolvedValue(draft)

        const {result} = renderHook(() =>
            usePublicationEditorWorkflow<Draft>({
                publicationId: 1,
                publication: draft,
                saveImpl,
                authRedirect: () => false,
            }),
        )

        act(() => {
            result.current.markDirty()
        })
        await act(async () => {
            await result.current.save({autosave: true})
        })

        expect(result.current.isDirty).toBe(false)
        expect(result.current.saveHint).toBe('Automatisch gespeichert')
    })
})
