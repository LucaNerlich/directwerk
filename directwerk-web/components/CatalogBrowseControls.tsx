'use client'

import {useId} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import type {CatalogTag} from '@/lib/catalog/catalogBrowse'

export interface CatalogBrowseControlsProps {
    searchLabel: string
    searchPlaceholder: string
    clearSearchLabel: string
    clearFiltersLabel: string
    categoriesLegend: string
    formatsLegend?: string
    hitCountLabel: string | null
    query: string
    onQueryChange: (value: string) => void
    categories: CatalogTag[]
    selectedCategoryIds: ReadonlySet<number>
    onToggleCategory: (id: number) => void
    formats?: CatalogTag[]
    selectedFormatIds?: ReadonlySet<number>
    onToggleFormat?: (id: number) => void
    onClear: () => void
    showClear: boolean
}

function ChipRow({
    legend,
    tags,
    selectedIds,
    onToggle,
}: {
    legend: string
    tags: CatalogTag[]
    selectedIds: ReadonlySet<number>
    onToggle: (id: number) => void
}): React.JSX.Element | null {
    if (tags.length === 0) {
        return null
    }
    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{legend}</p>
            <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                    const selected = selectedIds.has(tag.id)
                    return (
                        <Button
                            aria-pressed={selected}
                            key={tag.id}
                            onClick={() => onToggle(tag.id)}
                            size="sm"
                            type="button"
                            variant={selected ? 'default' : 'outline'}
                        >
                            {tag.name}
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}

/**
 * Search + taxonomy chips for public article/episode catalogs.
 * Chips are not cards — plain toggle buttons under a legend.
 */
export default function CatalogBrowseControls(
    props: CatalogBrowseControlsProps,
): React.JSX.Element {
    const searchInputId = useId()
    const {
        searchLabel,
        searchPlaceholder,
        clearSearchLabel,
        clearFiltersLabel,
        categoriesLegend,
        formatsLegend,
        hitCountLabel,
        query,
        onQueryChange,
        categories,
        selectedCategoryIds,
        onToggleCategory,
        formats = [],
        selectedFormatIds = new Set<number>(),
        onToggleFormat,
        onClear,
        showClear,
    } = props

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
                <label className="text-sm font-medium" htmlFor={searchInputId}>
                    {searchLabel}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                        aria-label={searchLabel}
                        className="sm:max-w-xs"
                        id={searchInputId}
                        onChange={(event) => onQueryChange(event.target.value)}
                        placeholder={searchPlaceholder}
                        type="search"
                        value={query}
                    />
                    {hitCountLabel !== null ? (
                        <p className="text-sm text-muted-foreground" role="status">
                            {hitCountLabel}
                            {query.trim().length > 0 ? (
                                <>
                                    {' · '}
                                    <button
                                        className="font-medium text-primary underline-offset-4 hover:underline"
                                        onClick={() => onQueryChange('')}
                                        type="button"
                                    >
                                        {clearSearchLabel}
                                    </button>
                                </>
                            ) : null}
                        </p>
                    ) : null}
                </div>
            </div>
            <ChipRow
                legend={categoriesLegend}
                onToggle={onToggleCategory}
                selectedIds={selectedCategoryIds}
                tags={categories}
            />
            {formatsLegend !== undefined && onToggleFormat !== undefined ? (
                <ChipRow
                    legend={formatsLegend}
                    onToggle={onToggleFormat}
                    selectedIds={selectedFormatIds}
                    tags={formats}
                />
            ) : null}
            {showClear ? (
                <div>
                    <Button onClick={onClear} size="sm" type="button" variant="ghost">
                        {clearFiltersLabel}
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
