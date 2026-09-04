'use client'

import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import {Input} from '@directwerk/ui/components/input'

import AccessPolicySelect from '@/components/publication/AccessPolicySelect'
import type {AccessPolicy, CategorySummary, FormatSummary} from '@directwerk/api/types'

export type BulkEditOperation =
    | {kind: 'formats', formatIds: number[]}
    | {kind: 'categories', categoryIds: number[]}
    | {kind: 'accessPolicy', accessPolicy: AccessPolicy}

type BulkEditKind = BulkEditOperation['kind']

interface BulkEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    contentLabel: string
    selectedCount: number
    draftCount: number
    formats?: FormatSummary[]
    categories: CategorySummary[]
    busy: boolean
    onApply: (operation: BulkEditOperation) => void
}

function contentLabelPluralForms(contentLabel: string): {
    nominative: string
    dative: string
} {
    return contentLabel === 'Beitrag'
        ? {nominative: 'Beiträge', dative: 'Beiträgen'}
        : {nominative: `${contentLabel}n`, dative: `${contentLabel}n`}
}

export default function BulkEditDialog({
    open,
    onOpenChange,
    contentLabel,
    selectedCount,
    draftCount,
    formats,
    categories,
    busy,
    onApply,
}: BulkEditDialogProps): React.JSX.Element {
    const contentLabelPlural = contentLabelPluralForms(contentLabel)
    const [kind, setKind] = useState<BulkEditKind>('accessPolicy')
    const [kindChosen, setKindChosen] = useState(false)
    const [selectedFormatIds, setSelectedFormatIds] = useState<number[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')

    const formatOptions = formats ?? []
    const hasFormats = formatOptions.length > 0
    const hasCategories = categories.length > 0

    useEffect(() => {
        if (!open) {
            return
        }
        setSelectedFormatIds([])
        setSelectedCategoryIds([])
        setAccessPolicy('FREE')
        setKindChosen(false)
        setKind(
            hasFormats ? 'formats' : hasCategories ? 'categories' : 'accessPolicy',
        )
        // Reset only when the dialog opens; option availability is captured at open time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    // Options can arrive after the dialog opened (e.g. categories are loaded
    // lazily on open). Follow availability until the user picks a kind
    // explicitly, without wiping their selections.
    useEffect(() => {
        if (!open || kindChosen) {
            return
        }
        setKind(
            hasFormats ? 'formats' : hasCategories ? 'categories' : 'accessPolicy',
        )
    }, [hasCategories, hasFormats, kindChosen, open])

    function chooseKind(next: BulkEditKind): void {
        setKindChosen(true)
        setKind(next)
    }

    const applyEnabled =
        draftCount > 0 &&
        (kind === 'formats'
            ? selectedFormatIds.length > 0
            : kind === 'categories'
              ? selectedCategoryIds.length > 0
              : true)

    const toggleFormat = (formatId: number, checked: boolean): void => {
        setSelectedFormatIds((current) =>
            checked ? [...current, formatId] : current.filter((id) => id !== formatId),
        )
    }

    const toggleCategory = (categoryId: number, checked: boolean): void => {
        setSelectedCategoryIds((current) =>
            checked ? [...current, categoryId] : current.filter((id) => id !== categoryId),
        )
    }

    const handleApply = (): void => {
        if (kind === 'formats' && selectedFormatIds.length > 0) {
            onApply({formatIds: selectedFormatIds, kind: 'formats'})
        } else if (kind === 'categories' && selectedCategoryIds.length > 0) {
            onApply({categoryIds: selectedCategoryIds, kind: 'categories'})
        } else if (kind === 'accessPolicy') {
            onApply({accessPolicy, kind: 'accessPolicy'})
        }
    }

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{contentLabelPlural.nominative} bearbeiten</DialogTitle>
                    <DialogDescription>
                        Es wird immer eine Änderung gleichzeitig auf alle ausgewählten
                        Entwürfe angewendet. Auswahl und Formate werden dabei ersetzt,
                        nicht ergänzt.
                    </DialogDescription>
                </DialogHeader>
                {draftCount < selectedCount ? (
                    <p className="text-sm text-muted-foreground">
                        {draftCount} von {selectedCount} ausgewählten{' '}
                        {contentLabelPlural.dative} sind Entwürfe — veröffentlichte{' '}
                        {contentLabelPlural.nominative} werden übersprungen.
                    </p>
                ) : null}
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                    <legend className="text-sm font-medium">Änderung</legend>
                    {hasFormats ? (
                        <label className="flex items-center gap-2 text-sm">
                            <Input
                                checked={kind === 'formats'}
                                className="size-4 shrink-0"
                                name="bulk-edit-kind"
                                onChange={() => chooseKind('formats')}
                                type="radio"
                            />
                            Formate
                        </label>
                    ) : null}
                    {hasCategories ? (
                        <label className="flex items-center gap-2 text-sm">
                            <Input
                                checked={kind === 'categories'}
                                className="size-4 shrink-0"
                                name="bulk-edit-kind"
                                onChange={() => chooseKind('categories')}
                                type="radio"
                            />
                            Kategorien
                        </label>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm">
                        <Input
                            checked={kind === 'accessPolicy'}
                            className="size-4 shrink-0"
                            name="bulk-edit-kind"
                            onChange={() => chooseKind('accessPolicy')}
                            type="radio"
                        />
                        Zugriff
                    </label>
                </fieldset>
                {kind === 'formats' ? (
                    <div className="grid gap-2">
                        <p className="text-xs text-muted-foreground" id="bulk-edit-formats-hint">
                            Ersetzt die Formate aller ausgewählten Entwürfe durch diese Auswahl.
                        </p>
                        <div aria-describedby="bulk-edit-formats-hint" className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border p-3" role="group" aria-label="Formate wählen">
                        {formatOptions.map((format) => (
                            <label className="flex items-center gap-2 text-sm" key={format.id}>
                                <Input
                                    checked={selectedFormatIds.includes(format.id)}
                                    className="size-4 shrink-0"
                                    onChange={(event) =>
                                        toggleFormat(format.id, event.target.checked)
                                    }
                                    type="checkbox"
                                />
                                {format.name}
                            </label>
                        ))}
                        </div>
                    </div>
                ) : null}
                {kind === 'categories' ? (
                    <div className="grid gap-2">
                        <p className="text-xs text-muted-foreground" id="bulk-edit-categories-hint">
                            Ersetzt die Kategorien aller ausgewählten Entwürfe durch diese Auswahl.
                        </p>
                        <div aria-describedby="bulk-edit-categories-hint" aria-label="Kategorien wählen" className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border p-3" role="group">
                        {categories.map((category) => (
                            <label className="flex items-center gap-2 text-sm" key={category.id}>
                                <Input
                                    checked={selectedCategoryIds.includes(category.id)}
                                    className="size-4 shrink-0"
                                    onChange={(event) =>
                                        toggleCategory(category.id, event.target.checked)
                                    }
                                    type="checkbox"
                                />
                                {category.name}
                            </label>
                        ))}
                        </div>
                    </div>
                ) : null}
                {kind === 'accessPolicy' ? (
                    <AccessPolicySelect onChange={setAccessPolicy} value={accessPolicy} />
                ) : null}
                <DialogFooter>
                    <Button
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        Abbrechen
                    </Button>
                    <Button disabled={busy || !applyEnabled} onClick={handleApply} type="button">
                        {busy ? 'Wird angewendet…' : 'Anwenden'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
