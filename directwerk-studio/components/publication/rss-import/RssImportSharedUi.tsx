'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import SelectControl from '@/components/studio/SelectControl'
import LevelSelect from '@/components/studio/LevelSelect'
import type {AccessPolicy} from '@directwerk/api/types'

import type {RssWizardStepDef} from './types'

export function RssWizardStepPills({
    steps,
    step,
}: {
    steps: ReadonlyArray<RssWizardStepDef>
    step: string
}): React.JSX.Element {
    return (
        <ol className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            {steps.map(({id, label}) => (
                <li
                    aria-current={step === id ? 'step' : undefined}
                    key={id}
                    className={
                        step === id
                            ? 'rounded-full bg-primary px-2.5 py-1 text-primary-foreground'
                            : 'rounded-full bg-muted px-2.5 py-1'
                    }
                >
                    {label}
                </li>
            ))}
        </ol>
    )
}

export function IdCheckboxList({
    items,
    selectedIds,
    onChange,
    disabled,
}: {
    items: ReadonlyArray<{id: number; name: string}>
    selectedIds: Set<number>
    onChange: (next: Set<number>) => void
    disabled: boolean
}): React.JSX.Element {
    return (
        <ul className="grid gap-2">
            {items.map((item) => (
                <li key={item.id}>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            checked={selectedIds.has(item.id)}
                            disabled={disabled}
                            onChange={(event) => {
                                const next = new Set(selectedIds)
                                if (event.target.checked) {
                                    next.add(item.id)
                                } else {
                                    next.delete(item.id)
                                }
                                onChange(next)
                            }}
                            type="checkbox"
                        />
                        {item.name}
                    </label>
                </li>
            ))}
        </ul>
    )
}

export function AccessPolicyFields({
    accessPolicy,
    onAccessPolicyChange,
    requiredLevelSortOrder,
    onRequiredLevelChange,
    disabled,
    ariaLabel,
    freeLabel,
    paidLabel,
    levelLabel,
    levelHint,
}: {
    accessPolicy: AccessPolicy
    onAccessPolicyChange: (policy: AccessPolicy) => void
    requiredLevelSortOrder: number | null
    onRequiredLevelChange: (value: number | null) => void
    disabled: boolean
    ariaLabel: string
    freeLabel: string
    paidLabel: string
    levelLabel: string
    levelHint?: string
}): React.JSX.Element {
    return (
        <>
            <SelectControl
                aria-label={ariaLabel}
                disabled={disabled}
                onChange={(event) =>
                    onAccessPolicyChange(event.target.value === 'PAID' ? 'PAID' : 'FREE')
                }
                value={accessPolicy}
            >
                <option value="FREE">{freeLabel}</option>
                <option value="PAID">{paidLabel}</option>
            </SelectControl>
            {accessPolicy === 'PAID' ? (
                <label className="grid gap-1.5">
                    <span className="text-sm font-medium">{levelLabel}</span>
                    <LevelSelect
                        disabled={disabled}
                        onChange={onRequiredLevelChange}
                        value={requiredLevelSortOrder}
                    />
                    {levelHint != null ? (
                        <span className="text-xs text-muted-foreground">{levelHint}</span>
                    ) : null}
                </label>
            ) : null}
        </>
    )
}

export function BulkImportPanel({
    pendingCount,
    alreadyImportedCount,
    itemNounPlural,
    busy,
    disabled,
    onBulkImport,
    children,
}: {
    pendingCount: number
    alreadyImportedCount: number
    itemNounPlural: string
    busy: boolean
    disabled: boolean
    onBulkImport: () => void
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
            <div>
                <p className="text-sm font-medium">Stapelimport im Hintergrund</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    {pendingCount} neue {itemNounPlural} mit diesen Einstellungen importieren
                    {alreadyImportedCount > 0
                        ? ` (${alreadyImportedCount} bereits vorhanden werden übersprungen)`
                        : ''}
                    . Du erhältst eine E-Mail, sobald der Import fertig ist.
                </p>
            </div>
            {children}
            <div>
                <Button
                    disabled={disabled || busy || pendingCount === 0}
                    onClick={onBulkImport}
                    type="button"
                    variant="outline"
                >
                    {busy
                        ? 'Wird gestartet…'
                        : `${pendingCount} ${itemNounPlural} als Hintergrund-Job importieren`}
                </Button>
            </div>
        </div>
    )
}

export function OptionalCreateNameField({
    canCreate,
    label,
    placeholder,
    value,
    onChange,
    disabled,
    adminOnlyHint,
}: {
    canCreate: boolean
    label: string
    placeholder: string
    value: string
    onChange: (value: string) => void
    disabled: boolean
    adminOnlyHint?: string
}): React.JSX.Element | null {
    if (canCreate) {
        return (
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">{label}</span>
                <Input
                    disabled={disabled}
                    maxLength={255}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    value={value}
                />
            </label>
        )
    }
    if (adminOnlyHint != null) {
        return <p className="text-sm text-muted-foreground">{adminOnlyHint}</p>
    }
    return null
}
