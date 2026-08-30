'use client'

import {useCallback, useState} from 'react'

import type {AccessPolicy} from '@directwerk/api/types'
import {
    fromDatetimeLocalValue,
    isPastOrPresentDatetimeLocal,
    toDatetimeLocalValue,
} from '@directwerk/api/datetime/publicationSchedule'

export interface PublicationEditorFieldsState {
    accessPolicy: AccessPolicy
    setAccessPolicy: (value: AccessPolicy) => void
    requiredLevelSortOrder: number | null
    setRequiredLevelSortOrder: (value: number | null) => void
    notifySubscribers: boolean
    setNotifySubscribers: (value: boolean) => void
    scheduledAt: string
    setScheduledAt: (value: string) => void
    applyPublicationSchedule: (scheduledAtIso: string | null | undefined) => void
    parseScheduledAt: () => string | null
    scheduleValidationError: string | null
    setScheduleValidationError: (message: string | null) => void
    publishedAt: string
    setPublishedAt: (value: string) => void
    applyPublicationPublishedAt: (publishedAtIso: string | null | undefined) => void
    parsePublishedAt: () => string | null
    publishValidationError: string | null
    setPublishValidationError: (message: string | null) => void
    validatePublishedAt: () =>
        | {valid: true; iso: string | null}
        | {valid: false; message: string}
}

export function usePublicationEditorFields(): PublicationEditorFieldsState {
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(
        null,
    )
    const [notifySubscribers, setNotifySubscribers] = useState(false)
    const [scheduledAt, setScheduledAt] = useState('')
    const [publishedAt, setPublishedAt] = useState('')
    const [scheduleValidationError, setScheduleValidationError] = useState<string | null>(
        null,
    )
    const [publishValidationError, setPublishValidationError] = useState<string | null>(
        null,
    )

    const applyPublicationSchedule = useCallback(
        (scheduledAtIso: string | null | undefined) => {
            setScheduledAt(toDatetimeLocalValue(scheduledAtIso))
        },
        [],
    )

    const applyPublicationPublishedAt = useCallback(
        (publishedAtIso: string | null | undefined) => {
            setPublishedAt(toDatetimeLocalValue(publishedAtIso))
        },
        [],
    )

    const parseScheduledAt = useCallback((): string | null => {
        return fromDatetimeLocalValue(scheduledAt)
    }, [scheduledAt])

    const parsePublishedAt = useCallback((): string | null => {
        return fromDatetimeLocalValue(publishedAt)
    }, [publishedAt])

    const validatePublishedAt = useCallback(():
        | {valid: true; iso: string | null}
        | {valid: false; message: string} => {
        if (publishedAt.trim().length === 0) {
            return {valid: true, iso: null}
        }
        if (!isPastOrPresentDatetimeLocal(publishedAt)) {
            return {
                valid: false,
                message: 'Veröffentlichungsdatum darf nicht in der Zukunft liegen.',
            }
        }
        const iso = parsePublishedAt()
        if (iso === null) {
            return {
                valid: false,
                message: 'Bitte ein gültiges Veröffentlichungsdatum wählen.',
            }
        }
        return {valid: true, iso}
    }, [parsePublishedAt, publishedAt])

    return {
        accessPolicy,
        setAccessPolicy,
        requiredLevelSortOrder,
        setRequiredLevelSortOrder,
        notifySubscribers,
        setNotifySubscribers,
        scheduledAt,
        setScheduledAt,
        applyPublicationSchedule,
        parseScheduledAt,
        scheduleValidationError,
        setScheduleValidationError,
        publishedAt,
        setPublishedAt,
        applyPublicationPublishedAt,
        parsePublishedAt,
        publishValidationError,
        setPublishValidationError,
        validatePublishedAt,
    }
}
