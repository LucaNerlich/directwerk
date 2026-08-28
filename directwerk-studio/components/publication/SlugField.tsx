'use client'

import {Input} from '@directwerk/ui/components/input'

import {useEffect, useState} from 'react'

interface SlugFieldProps {
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    checkTaken: (slug: string) => boolean
}

/**
 * Slug input with debounced uniqueness feedback.
 */
export default function SlugField({
    value,
    onChange,
    disabled = false,
    checkTaken,
}: SlugFieldProps): React.JSX.Element {
    const [debouncedSlug, setDebouncedSlug] = useState(value)

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
        <label className="grid gap-2 text-sm font-medium">
            <span>Slug</span>
            <Input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                value={value}
            />
            {isTaken ? (
                <span className="text-xs font-normal text-destructive" role="alert">
                    Dieser Slug ist bereits vergeben.
                </span>
            ) : trimmed.length > 0 ? (
                <span className="text-xs font-normal text-muted-foreground">Slug verfügbar.</span>
            ) : null}
        </label>
    )
}
