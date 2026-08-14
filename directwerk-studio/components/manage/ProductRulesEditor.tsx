'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Button} from '@directwerk/ui/components/button'

import {useCallback, useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    listCategories,
    listFormats,
    listMedia,
    listProductRules,
    listSeries,
    replaceProductRules,
} from '@/lib/api/tenantApi'
import type {
    CategorySummary,
    FormatSummary,
    MediaAsset,
    ProductAccessRuleInput,
    ProductAccessScopeType,
    SeriesSummary,
} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

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
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return
            }
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
            listSeries(host).catch(() => [] as SeriesSummary[]),
            listFormats(host).catch(() => [] as FormatSummary[]),
            listCategories(host).catch(() => [] as CategorySummary[]),
            listMedia(host).catch(() => [] as MediaAsset[]),
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
                    `Regel ${draft.scopeType} benötigt eine gültige Scope-ID.`,
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
        return <p>Regeln laden…</p>
    }

    return (
        <section aria-labelledby="product-rules-heading">
            <h2 id="product-rules-heading">Zugriffsregeln (PACKAGE)</h2>
            <p>
                Regeln ersetzen die komplette Regelmenge beim Speichern. LEVEL-Produkte
                haben keine Regeln. <code>DIGITAL_ASSET</code> schaltet eine
                Bonusdatei aus der Mediathek frei.
            </p>
            {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Noch keine Regeln. Ein Paket ohne Regeln schaltet keine bezahlten Inhalte frei.
                </p>
            ) : null}
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {statusMessage ? <p role="status">{statusMessage}</p> : null}

            {drafts.map((draft, index) => (
                <p key={`rule-${index}`}>
                    <label htmlFor={`rule-scope-${index}`}>Scope</label>{' '}
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
                                {scope}
                            </option>
                        ))}
                    </SelectControl>{' '}
                    {draft.scopeType === 'PODCAST_SERIES' ? (
                        <SelectControl
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
                    ) : null}
                    {draft.scopeType === 'FORMAT' ? (
                        <SelectControl
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
                    ) : null}
                    {draft.scopeType === 'DIGITAL_ASSET' ? (
                        <SelectControl
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
                    ) : null}
                    {draft.scopeType === 'CATEGORY' ? (
                        <SelectControl
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
                    ) : null}
                    {' '}
                    <Button
                        onClick={() =>
                            setDrafts((current) =>
                                current.filter((_, draftIndex) => draftIndex !== index),
                            )
                        }
                        type="button"
                    >
                        Entfernen
                    </Button>
                </p>
            ))}

            <p>
                <Button
                    onClick={() =>
                        setDrafts((current) => [
                            ...current,
                            {scopeType: 'ALL_PODCASTS', scopeId: ''},
                        ])
                    }
                    type="button"
                >
                    Regel hinzufügen
                </Button>{' '}
                <Button
                    disabled={isSaving}
                    onClick={() => void handleSave()}
                    type="button"
                >
                    {isSaving ? 'Speichern…' : 'Regeln speichern'}
                </Button>
            </p>
        </section>
    )
}
