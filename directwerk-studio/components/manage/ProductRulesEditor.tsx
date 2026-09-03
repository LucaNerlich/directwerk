'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Label} from '@directwerk/ui/components/label'

import {useCallback, useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'

import {listCategories, listFormats} from '@/lib/api/catalogApi'
import {listMedia} from '@/lib/api/mediaApi'
import {listSeries} from '@/lib/api/podcastApi'
import {listProductRules, replaceProductRules} from '@/lib/api/subscriptionApi'
import {productScopeLabel} from '@/lib/subscription/displayLabels'
import type {
    CategorySummary,
    FormatSummary,
    MediaAsset,
    ProductAccessRuleInput,
    ProductAccessScopeType,
    SeriesSummary,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface ProductRulesEditorProps {
    productId: number
}

interface DraftRule {
    scopeType: ProductAccessScopeType
    scopeId: string
}

const RULE_SCOPES: ProductAccessScopeType[] = [
    'ALL_PODCASTS',
    'PODCAST_SERIES',
    'FORMAT',
    'CATEGORY',
    'DIGITAL_ASSET',
]

export default function ProductRulesEditor({
    productId,
}: ProductRulesEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [drafts, setDrafts] = useState<DraftRule[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [documents, setDocuments] = useState<MediaAsset[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [router],
    )

    useEffect(() => {
        let active = true
        const host = getClientTenantHost()

        Promise.all([
            listProductRules(host, productId),
            listSeries(host),
            listFormats(host),
            listCategories(host),
            listMedia(host),
        ])
            .then(([rules, seriesList, formatList, categoryList, mediaList]) => {
                if (!active) {
                    return
                }
                setDrafts(
                    rules.map((rule) => ({
                        scopeType: rule.scopeType,
                        scopeId: rule.scopeId === null ? '' : String(rule.scopeId),
                    })),
                )
                setSeries(seriesList)
                setFormats(formatList.filter((item) => item.active))
                setCategories(categoryList.filter((item) => item.active))
                setDocuments(
                    mediaList.filter(
                        (item) =>
                            item.assetType === 'DOCUMENT' && item.status === 'READY',
                    ),
                )
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                handleAuthError(error)
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [handleAuthError, productId])

    function updateDraft(index: number, patch: Partial<DraftRule>): void {
        setDrafts((current) =>
            current.map((draft, draftIndex) =>
                draftIndex === index ? {...draft, ...patch} : draft,
            ),
        )
    }

    async function handleSave(): Promise<void> {
        setIsSaving(true)
        setErrorMessage(null)
        setStatusMessage(null)

        const rules: ProductAccessRuleInput[] = []
        for (const draft of drafts) {
            if (draft.scopeType === 'ALL_PODCASTS') {
                rules.push({scopeType: 'ALL_PODCASTS', scopeId: null})
                continue
            }

            const scopeId = Number.parseInt(draft.scopeId, 10)
            if (!Number.isSafeInteger(scopeId) || scopeId < 1) {
                setErrorMessage(
                    `Regel „${productScopeLabel(draft.scopeType)}“ braucht noch ein Ziel — bitte wählen.`,
                )
                setIsSaving(false)
                return
            }
            rules.push({scopeType: draft.scopeType, scopeId})
        }

        try {
            const saved = await replaceProductRules(
                getClientTenantHost(),
                productId,
                rules,
            )
            setDrafts(
                saved.map((rule) => ({
                    scopeType: rule.scopeType,
                    scopeId: rule.scopeId === null ? '' : String(rule.scopeId),
                })),
            )
            setStatusMessage('Regeln gespeichert.')
        } catch (error) {
            handleAuthError(error)
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <Card aria-busy="true">
                <CardHeader>
                    <CardTitle>Zugriffsregeln (PACKAGE)</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground" role="status">Regeln laden…</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle id="product-rules-heading">Zugriffsregeln (PACKAGE)</CardTitle>
                <CardDescription>
                    Regeln ersetzen die komplette Regelmenge beim Speichern. LEVEL-Produkte
                    haben keine Regeln. Bonusdatei schaltet eine
                    Datei aus der Mediathek frei.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
            {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Noch keine Regeln. Ein Paket ohne Regeln schaltet keine bezahlten Inhalte frei.
                </p>
            ) : null}
            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {drafts.length > 0 ? (
            <ul className="grid gap-3">
            {drafts.map((draft, index) => (
                <li
                    className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    key={`rule-${index}`}
                >
                    <div className="grid gap-2">
                    <Label htmlFor={`rule-scope-${index}`}>Bereich (Regel {index + 1})</Label>
                    <SelectControl
                        id={`rule-scope-${index}`}
                        onChange={(event) =>
                            updateDraft(index, {
                                scopeType: event.target
                                    .value as ProductAccessScopeType,
                                scopeId: '',
                            })
                        }
                        value={draft.scopeType}
                    >
                        {RULE_SCOPES.map((scope) => (
                            <option key={scope} value={scope}>
                                {productScopeLabel(scope)}
                            </option>
                        ))}
                    </SelectControl>
                    </div>
                    {draft.scopeType === 'ALL_PODCASTS' ? (
                        <p className="text-sm text-muted-foreground sm:pb-2">
                            Gilt für alle Podcasts — kein Ziel nötig.
                        </p>
                    ) : null}
                    {draft.scopeType === 'PODCAST_SERIES' ? (
                        <div className="grid gap-2">
                        <Label htmlFor={`rule-target-${index}`}>Sendung</Label>
                        <SelectControl
                            id={`rule-target-${index}`}
                            onChange={(event) =>
                                updateDraft(index, {scopeId: event.target.value})
                            }
                            value={draft.scopeId}
                        >
                            <option value="">Sendung wählen</option>
                            {series.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.title}
                                </option>
                            ))}
                        </SelectControl>
                        </div>
                    ) : null}
                    {draft.scopeType === 'FORMAT' ? (
                        <div className="grid gap-2">
                        <Label htmlFor={`rule-target-${index}`}>Format</Label>
                        <SelectControl
                            id={`rule-target-${index}`}
                            onChange={(event) =>
                                updateDraft(index, {scopeId: event.target.value})
                            }
                            value={draft.scopeId}
                        >
                            <option value="">Format wählen</option>
                            {formats.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </SelectControl>
                        </div>
                    ) : null}
                    {draft.scopeType === 'DIGITAL_ASSET' ? (
                        <div className="grid gap-2">
                        <Label htmlFor={`rule-target-${index}`}>Bonusdatei</Label>
                        <SelectControl
                            id={`rule-target-${index}`}
                            onChange={(event) =>
                                updateDraft(index, {scopeId: event.target.value})
                            }
                            value={draft.scopeId}
                        >
                            <option value="">Datei wählen</option>
                            {documents.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                    {asset.originalFilename ?? `Datei #${asset.id}`}
                                </option>
                            ))}
                        </SelectControl>
                        </div>
                    ) : null}
                    {draft.scopeType === 'CATEGORY' ? (
                        <div className="grid gap-2">
                        <Label htmlFor={`rule-target-${index}`}>Kategorie</Label>
                        <SelectControl
                            id={`rule-target-${index}`}
                            onChange={(event) =>
                                updateDraft(index, {scopeId: event.target.value})
                            }
                            value={draft.scopeId}
                        >
                            <option value="">Kategorie wählen</option>
                            {categories.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </SelectControl>
                        </div>
                    ) : null}
                    <div>
                    <Button
                        onClick={() =>
                            setDrafts((current) =>
                                current.filter((_, draftIndex) => draftIndex !== index),
                            )
                        }
                        type="button"
                        variant="outline"
                    >
                        Entfernen
                    </Button>
                    </div>
                </li>
            ))}
            </ul>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={() =>
                        setDrafts((current) => [
                            ...current,
                            {scopeType: 'ALL_PODCASTS', scopeId: ''},
                        ])
                    }
                    type="button"
                    variant="outline"
                >
                    Regel hinzufügen
                </Button>
                <Button
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                    type="button"
                >
                    {isSaving ? 'Speichern…' : 'Regeln speichern'}
                </Button>
            </div>
            </CardContent>
        </Card>
    )
}
