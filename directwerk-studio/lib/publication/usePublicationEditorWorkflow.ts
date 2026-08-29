'use client'

import {useCallback, useState} from 'react'

import {useDraftAutosave} from '@/lib/editor/useDraftAutosave'
import type {PublicationStatus} from '@directwerk/api/types'

export interface PublicationEditorWorkflowState<T extends {status: PublicationStatus}> {
    isSaving: boolean
    errorMessage: string | null
    setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>
    saveHint: string | null
    isDirty: boolean
    markDirty: () => void
    save: (options?: {autosave?: boolean}) => Promise<T | null>
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
    saveImpl: (options?: {autosave?: boolean}) => Promise<T | null>
    onWorkflowComplete?: (next: T) => void
    autosaveBlocked?: boolean
    authRedirect: (error: unknown) => boolean
}): PublicationEditorWorkflowState<T> {
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [saveHint, setSaveHint] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [dirtyRevision, setDirtyRevision] = useState(0)

    const markDirty = useCallback(() => {
        setIsDirty(true)
        setDirtyRevision((current) => current + 1)
        setSaveHint('Ungespeicherte Änderungen')
    }, [])

    const save = useCallback(
        async (options?: {autosave?: boolean}): Promise<T | null> => {
            if (loadError) {
                return null
            }

            setIsSaving(true)
            setErrorMessage(null)

            try {
                const result = await saveImpl(options)
                if (result !== null) {
                    setIsDirty(false)
                    setSaveHint(
                        options?.autosave === true
                            ? 'Automatisch gespeichert'
                            : 'Gespeichert',
                    )
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
                setIsSaving(false)
            }
        },
        [authRedirect, loadError, saveImpl],
    )

    useDraftAutosave({
        enabled:
            (publication?.status ?? 'DRAFT') === 'DRAFT' && publicationId !== undefined,
        isDirty,
        isSaving: isSaving || autosaveBlocked,
        onSave: async () => { await save({autosave: true}) },
        revision: dirtyRevision,
    })

    const runWorkflow = useCallback(
        async (
            action: (current: T) => Promise<T>,
            options?: {persistTags?: boolean},
        ) => {
            const status = publication?.status ?? 'DRAFT'
            let current: T | null
            if (publicationId === undefined || status === 'DRAFT') {
                current = await save()
            } else {
                current = publication
            }
            if (current === null) {
                return
            }

            setIsSaving(true)
            setErrorMessage(null)
            try {
                if (options?.persistTags === true && persistTags !== undefined) {
                    current = await persistTags(current)
                }
                const next = await action(current)
                onWorkflowComplete?.(next)
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
        [authRedirect, onWorkflowComplete, persistTags, publication, publicationId, save],
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
