'use client'

import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'

import {useDraftAutosave} from '@/lib/editor/useDraftAutosave'
import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationEditorWorkflowState<T extends {status: PublicationStatus}> {
    isSaving: boolean
    errorMessage: string | null
    setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>
    saveHint: string | null
    isDirty: boolean
    markDirty: () => void
    save: (options?: {
        autosave?: boolean
        deferCreateRedirect?: boolean
    }) => Promise<T | null>
    runWorkflow: (
        action: (current: T) => Promise<T>,
        options?: {persistTags?: boolean},
    ) => Promise<void>
}

export function usePublicationEditorWorkflow<T extends {
    id: number
    status: PublicationStatus
}>({
    publicationId,
    publication,
    loadError = false,
    persistTags,
    saveImpl,
    onWorkflowComplete,
    autosaveBlocked = false,
    authRedirect,
}: {
    publicationId?: number
    publication: T | null
    loadError?: boolean
    persistTags?: (current: T) => Promise<T>
    saveImpl: (options?: {
        autosave?: boolean
        deferCreateRedirect?: boolean
    }) => Promise<T | null>
    onWorkflowComplete?: (next: T) => void
    autosaveBlocked?: boolean
    authRedirect: (error: unknown) => boolean
}): PublicationEditorWorkflowState<T> {
    const [isSaving, setIsSaving] = useState(false)
    const [isAutosaving, setIsAutosaving] = useState(false)
    const autosaveInFlightRef = useRef<Promise<unknown> | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [saveHint, setSaveHint] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [dirtyRevision, setDirtyRevision] = useState(0)
    const publicationRef = useRef(publication)
    // Refs are written in a layout effect, not during render: a discarded concurrent render must
    // not publish its props, and React Compiler can then optimise the editor (#1087).
    useLayoutEffect(() => {
        publicationRef.current = publication
    }, [publication])

    // DRAFT writes live columns; PUBLISHED stages a working-draft overlay. Pure so the render
    // output never reads the layout-effect ref (#1087 review).
    const isEditableStatus = (status: string | null | undefined): boolean =>
        status === null || status === undefined || status === 'DRAFT' || status === 'PUBLISHED'

    const isEditablePublication = useCallback((): boolean => {
        return isEditableStatus(publicationRef.current?.status)
    }, [])

    const canAutosave = useCallback((): boolean => {
        return publicationId !== undefined && isEditablePublication()
    }, [publicationId, isEditablePublication])

    const dirtyRevisionRef = useRef(0)

    const markDirty = useCallback(() => {
        if (!isEditablePublication()) {
            return
        }
        setIsDirty(true)
        // #557: mirror the counter so a save can compare it after the round trip — React state
        // read inside the callback would be the value captured when the request started.
        dirtyRevisionRef.current += 1
        setDirtyRevision((current) => current + 1)
        setSaveHint('Ungespeicherte Änderungen')
    }, [isEditablePublication])

    const save = useCallback(
        async (options?: {
            autosave?: boolean
            fromWorkflow?: boolean
            deferCreateRedirect?: boolean
        }): Promise<T | null> => {
            if (loadError) {
                return null
            }

            if (options?.fromWorkflow === true && autosaveInFlightRef.current !== null) {
                // A workflow action (publish/archive/...) must not overlap an autosave PUT that
                // is still in flight, or the older text can land after the action.
                await autosaveInFlightRef.current.catch(() => null)
            }

            if (!isEditablePublication()) {
                if (options?.autosave === true) {
                    setIsDirty(false)
                }
                return publicationRef.current
            }

            const userInitiated = !options?.fromWorkflow && options?.autosave !== true
            if (userInitiated) {
                setIsSaving(true)
            }
            if (options?.autosave === true) {
                setIsAutosaving(true)
            }
            setErrorMessage(null)
            const revisionAtStart = dirtyRevisionRef.current

            try {
                const pending = saveImpl(options)
                if (options?.autosave === true) {
                    autosaveInFlightRef.current = pending
                }
                const result = await pending
                if (result !== null) {
                    // #557: only clear the dirty flag when nothing was typed while the request was
                    // in flight — otherwise the editor reported "Automatisch gespeichert" while the
                    // last edit was never sent, and the autosave effect could not re-arm because
                    // isDirty had been reset.
                    if (dirtyRevisionRef.current === revisionAtStart) {
                        setIsDirty(false)
                        setSaveHint(
                            options?.autosave === true
                                ? 'Automatisch gespeichert'
                                : 'Gespeichert',
                        )
                    }
                }
                return result
            } catch (error) {
                if (authRedirect(error)) {
                    return null
                }
                setErrorMessage(
                    error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
                )
                return null
            } finally {
                if (userInitiated) {
                    setIsSaving(false)
                }
                if (options?.autosave === true) {
                    setIsAutosaving(false)
                    autosaveInFlightRef.current = null
                }
            }
        },
        [authRedirect, isEditablePublication, loadError, saveImpl],
    )

    // New items cannot autosave (no id yet), and no editor registered an unload guard, so a
    // reload or tab close silently discarded the whole draft (#1056).
    useEffect(() => {
        if (!isDirty) {
            return
        }
        const guard = (event: BeforeUnloadEvent): void => {
            event.preventDefault()
            event.returnValue = ''
        }
        // In-app navigation never unloads the document, so the back link and side nav need their
        // own guard while the draft is dirty (#1056 review).
        const onClick = (event: MouseEvent): void => {
            if (event.defaultPrevented || event.button !== 0 ||
                event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return
            }
            const anchor = (event.target as HTMLElement | null)?.closest?.('a')
            if (anchor === null || anchor === undefined) {
                return
            }
            const href = anchor.getAttribute('href')
            if (href === null || href.startsWith('#') || anchor.target === '_blank') {
                return
            }
            if (new URL(anchor.href, window.location.href).origin !== window.location.origin) {
                return
            }
            if (!window.confirm('Ungespeicherte Änderungen verwerfen?')) {
                event.preventDefault()
                event.stopPropagation()
            }
        }
        window.addEventListener('beforeunload', guard)
        document.addEventListener('click', onClick, true)
        return () => {
            window.removeEventListener('beforeunload', guard)
            document.removeEventListener('click', onClick, true)
        }
    }, [isDirty])

    useDraftAutosave({
        enabled: publicationId !== undefined && isEditableStatus(publication?.status),
        isDirty,
        isSaving: isSaving || isAutosaving || autosaveBlocked,
        canSave: canAutosave,
        onSave: async () => {
            await save({autosave: true})
        },
        revision: dirtyRevision,
    })

    const runWorkflow = useCallback(
        async (
            action: (current: T) => Promise<T>,
            options?: {persistTags?: boolean},
        ) => {
            setIsSaving(true)
            setErrorMessage(null)
            try {
                const status = publicationRef.current?.status ?? 'DRAFT'
                let current: T | null
                if (
                    publicationId === undefined ||
                    status === 'DRAFT' ||
                    status === 'PUBLISHED'
                ) {
                    current = await save({fromWorkflow: true})
                } else {
                    current = publicationRef.current
                }
                if (current === null) {
                    return
                }

                if (options?.persistTags === true && persistTags !== undefined) {
                    current = await persistTags(current)
                }
                const next = await action(current)
                onWorkflowComplete?.(next)
                publicationRef.current = next
                setIsDirty(false)
            } catch (error) {
                if (authRedirect(error)) {
                    return
                }
                setErrorMessage(
                    error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
                )
            } finally {
                setIsSaving(false)
            }
        },
        [authRedirect, onWorkflowComplete, persistTags, publicationId, save],
    )

    return {
        isSaving,
        errorMessage,
        setErrorMessage,
        saveHint,
        isDirty,
        markDirty,
        save,
        runWorkflow,
    }
}
