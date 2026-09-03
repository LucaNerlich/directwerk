'use client'

import {Input} from '@directwerk/ui/components/input'

import {useEffect, useId, useState} from 'react'

interface SlugFieldProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    checkTaken: (slug: string) => boolean
}

export default function SlugField({
    value,
    onChange,
    disabled = false,
    checkTaken,
}: SlugFieldProps): React.JSX.Element {
    const [debouncedSlug, setDebouncedSlug] = useState(value)
    const inputId = useId()
    const hintId = useId()
    const statusId = useId()

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSlug(value)
        }, 400)
        return () => {
            window.clearTimeout(timer)
        }
    }, [value])

    const trimmed = debouncedSlug.trim()
    const isTaken = trimmed.length > 0 && checkTaken(trimmed)

    return (
        <div className="grid gap-2">
            <label className="grid gap-2 text-sm font-medium" htmlFor={inputId}>
                <span>Slug</span>
            </label>
            <Input
                aria-describedby={`${hintId} ${statusId}`}
                aria-invalid={isTaken}
                disabled={disabled}
                id={inputId}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            />
            <p className="text-xs font-normal text-muted-foreground" id={hintId}>
                Kleinbuchstaben, Zahlen und Bindestriche. Wird in der öffentlichen URL
                verwendet.
            </p>
            {isTaken ? (
                <p className="text-xs font-normal text-destructive" id={statusId} role="alert">
                    Dieser Slug ist bereits vergeben.
                </p>
            ) : trimmed.length > 0 ? (
                <p className="text-xs font-normal text-muted-foreground" id={statusId} role="status">
                    Slug verfügbar.
                </p>
            ) : (
                <span className="sr-only" id={statusId} role="status" />
            )}
        </div>
    )
}
