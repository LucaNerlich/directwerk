'use client'

import Link from 'next/link'

import {Input} from '@directwerk/ui/components/input'

import type {CategorySummary, FormatSummary} from '@directwerk/api/types'

interface FormatCategoryPickerProps {
    formats?: FormatSummary[]
    categories: CategorySummary[]
    selectedFormatIds: Set<number>
    selectedCategoryIds: Set<number>
    onFormatChange?: (ids: Set<number>) => void
    onCategoryChange: (ids: Set<number>) => void
    disabled?: boolean
    formatsNewHref?: string
}

/**
 * Shared multi-select for podcast formats and content categories.
 */
export default function FormatCategoryPicker({
    formats,
    categories,
    selectedFormatIds,
    selectedCategoryIds,
    onFormatChange,
    onCategoryChange,
    disabled = false,
    formatsNewHref = '/podcast/formats/new',
}: FormatCategoryPickerProps): React.JSX.Element {
    const showFormats = formats !== undefined && onFormatChange !== undefined

    return (
        <div className="grid gap-3">
            {showFormats ? (
                <div className="grid gap-2">
                    <p className="text-sm font-semibold">Formate</p>
                    {formats.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                            Keine Formate angelegt.{' '}
                            <Link href={formatsNewHref}>Formate einrichten</Link>
                        </p>
                    ) : (
                        formats.map((format) => (
                            <label key={format.id} className="flex items-center gap-2 text-sm">
                                <Input
                                    checked={selectedFormatIds.has(format.id)}
                                    className="size-4 shrink-0"
                                    disabled={disabled}
                                    onChange={(event) => {
                                        const next = new Set(selectedFormatIds)
                                        if (event.target.checked) {
                                            next.add(format.id)
                                        } else {
                                            next.delete(format.id)
                                        }
                                        onFormatChange(next)
                                    }}
                                    type="checkbox"
                                />
                                <span>{format.name}</span>
                            </label>
                        ))
                    )}
                </div>
            ) : null}
            <div className="grid gap-2">
                <p className="text-sm font-semibold">Kategorien</p>
                {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                        Keine Kategorien angelegt.{' '}
                        <Link href="/manage/categories/new">Kategorie anlegen</Link>
                    </p>
                ) : (
                    categories.map((category) => (
                        <label key={category.id} className="flex items-center gap-2 text-sm">
                            <Input
                                checked={selectedCategoryIds.has(category.id)}
                                className="size-4 shrink-0"
                                disabled={disabled}
                                onChange={(event) => {
                                    const next = new Set(selectedCategoryIds)
                                    if (event.target.checked) {
                                        next.add(category.id)
                                    } else {
                                        next.delete(category.id)
                                    }
                                    onCategoryChange(next)
                                }}
                                type="checkbox"
                            />
                            <span>{category.name}</span>
                        </label>
                    ))
                )}
            </div>
        </div>
    )
}
