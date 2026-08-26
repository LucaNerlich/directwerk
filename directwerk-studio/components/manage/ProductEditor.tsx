'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState, type FormEvent} from 'react'

import ProductRulesEditor from '@/components/manage/ProductRulesEditor'
import {
    createProduct,
    deactivateProduct,
    listProducts,
    suggestSlug,
    syncProductStripe,
    updateProduct,
} from '@/lib/api/tenantApi'
import type {BillingInterval, OfferingType, SubscriptionProduct} from '@directwerk/api/types'
import {formatMoney} from '@/lib/format/money'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface ProductEditorProps {
    productId?: number
}

export default function ProductEditor({
    productId,
}: ProductEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const isNew = productId === undefined
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [sortOrder, setSortOrder] = useState('0')
    const [offeringType, setOfferingType] = useState<OfferingType>('LEVEL')
    const [description, setDescription] = useState('')
    const [priceEuros, setPriceEuros] = useState('')
    const [currency, setCurrency] = useState('EUR')
    const [billingInterval, setBillingInterval] = useState<BillingInterval>('MONTH')
    const [active, setActive] = useState(true)
    const [product, setProduct] = useState<SubscriptionProduct | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (productId === undefined) {
            setIsLoading(false)
            return
        }

        const resolvedId = productId
        let activeLoad = true

        listProducts(getClientTenantHost())
            .then((products) => {
                if (!activeLoad) {
                    return
                }
                const found = products.find((item) => item.id === resolvedId)
                if (!found) {
                    setErrorMessage('Produkt wurde nicht gefunden.')
                    setIsLoading(false)
                    return
                }
                setProduct(found)
                setTitle(found.title)
                setSlug(found.slug)
                setSortOrder(String(found.sortOrder))
                setOfferingType(found.offeringType)
                setDescription(found.description ?? '')
                setPriceEuros(
                    found.priceCents !== null ? (found.priceCents / 100).toString() : '',
                )
                setCurrency(found.currency)
                setBillingInterval(found.billingInterval)
                setActive(found.active)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!activeLoad) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Produkt konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            activeLoad = false
        }
    }, [productId, router])

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [router],
    )

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setIsSaving(true)
        setErrorMessage(null)
        setStatusMessage(null)

        const host = getClientTenantHost()
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'produkt'
        const parsedSort = Number.parseInt(sortOrder, 10)
        const nextSortOrder = Number.isSafeInteger(parsedSort) && parsedSort >= 0
            ? parsedSort
            : 0
        const parsedEuros = Number.parseFloat(priceEuros.replace(',', '.'))
        const priceCents = Number.isFinite(parsedEuros) && parsedEuros >= 0
            ? Math.round(parsedEuros * 100)
            : undefined

        try {
            if (isNew) {
                const created = await createProduct(host, {
                    title: title.trim() || 'Ohne Titel',
                    slug: resolvedSlug,
                    sortOrder: nextSortOrder,
                    offeringType,
                    description: description.trim() || undefined,
                    priceCents,
                    currency: currency.trim().toUpperCase() || 'EUR',
                    billingInterval,
                })
                router.replace(`/manage/products/${created.id}`)
                return
            }

            const updated = await updateProduct(host, productId, {
                title: title.trim() || 'Ohne Titel',
                sortOrder: nextSortOrder,
                active,
                description: description.trim(),
                priceCents,
                currency: currency.trim().toUpperCase() || 'EUR',
                billingInterval,
            })
            setProduct(updated)
            setStatusMessage('Produkt gespeichert.')
        } catch (error) {
            authRedirect(error)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleSyncStripe(): Promise<void> {
        if (productId === undefined) {
            return
        }
        setIsSaving(true)
        setErrorMessage(null)
        try {
            const updated = await syncProductStripe(getClientTenantHost(), productId)
            setProduct(updated)
            setStatusMessage('Produkt mit Stripe synchronisiert.')
        } catch (error) {
            authRedirect(error)
        } finally {
            setIsSaving(false)
        }
    }

    async function handleDeactivate(): Promise<void> {
        if (productId === undefined) {
            return
        }

        setIsSaving(true)
        setErrorMessage(null)
        try {
            const updated = await deactivateProduct(
                getClientTenantHost(),
                productId,
            )
            setProduct(updated)
            setActive(false)
            setStatusMessage('Produkt deaktiviert.')
        } catch (error) {
            authRedirect(error)
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <p>Laden…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Abos
                    </p>
                    <h1>{isNew ? 'Neues Produkt' : 'Produkt bearbeiten'}</h1>
                </div>
                <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/manage/products">
                    Zurück zur Liste
                </Link>
            </header>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            {statusMessage ? <p role="status">{statusMessage}</p> : null}

            <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
                <p className="text-sm text-muted-foreground">
                    <strong>Typ</strong> bestimmt, was das Produkt freischaltet.
                    <strong> Abrechnungsintervall</strong> bestimmt, wie bezahlt wird.
                </p>
                <p>
                    <label htmlFor="product-title">Titel</label>
                    <br />
                    <Input
                        id="product-title"
                        maxLength={255}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        type="text"
                        value={title}
                    />
                </p>
                <p>
                    <label htmlFor="product-slug">Slug</label>
                    <br />
                    <Input
                        disabled={!isNew}
                        id="product-slug"
                        maxLength={64}
                        onChange={(event) => setSlug(event.target.value)}
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        required={isNew}
                        type="text"
                        value={slug}
                    />
                </p>
                <p>
                    <label htmlFor="product-offering">Typ — was wird freigeschaltet?</label>
                    <br />
                    <SelectControl
                        disabled={!isNew}
                        id="product-offering"
                        onChange={(event) =>
                            setOfferingType(event.target.value as OfferingType)
                        }
                        value={offeringType}
                    >
                        <option value="LEVEL">Stufe — Leiter, höhere Zahl schließt niedrigere ein</option>
                        <option value="PACKAGE">Paket — nur die Inhalte aus den Regeln</option>
                    </SelectControl>
                    <span className="mt-1 block text-sm text-muted-foreground">
                        {offeringType === 'PACKAGE'
                            ? 'Nach dem Speichern Regeln setzen. Ohne Regeln schaltet ein Paket nichts frei.'
                            : 'Stufen vergleichen die Sortierzahl mit der Mindest-Stufe: Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist.'}
                    </span>
                </p>
                <p>
                    <label htmlFor="product-sort">Sortierzahl der Stufe</label>
                    <br />
                    <Input
                        id="product-sort"
                        min={0}
                        onChange={(event) => setSortOrder(event.target.value)}
                        type="number"
                        value={sortOrder}
                    />
                    <span className="mt-1 block text-sm text-muted-foreground">
                        Höhere Zahl = höhere Stufe (z. B. 10 Fan, 20 Supporter).
                        Zugriff auf bezahlte Inhalte hat, wessen höchste Stufe ≥ Mindest-Stufe der Folge oder des Formats ist.
                    </span>
                </p>
                <p>
                    <label htmlFor="product-description">Beschreibung</label>
                    <br />
                    <Input
                        id="product-description"
                        maxLength={2000}
                        onChange={(event) => setDescription(event.target.value)}
                        type="text"
                        value={description}
                    />
                </p>
                <p>
                    <label htmlFor="product-price">Preis</label>
                    <br />
                    <Input
                        id="product-price"
                        min={0}
                        onChange={(event) => setPriceEuros(event.target.value)}
                        step="0.01"
                        type="number"
                        value={priceEuros}
                    />
                    <span className="mt-1 block text-sm text-muted-foreground">
                        Betrag in der gewählten Währung, z. B. 14,90. Ohne Preis kein Stripe-Checkout.
                    </span>
                </p>
                <p>
                    <label htmlFor="product-currency">Währung</label>
                    <br />
                    <SelectControl
                        id="product-currency"
                        onChange={(event) => setCurrency(event.target.value)}
                        value={currency}
                    >
                        {['EUR', 'USD', 'GBP'].includes(currency) ? null : (
                            <option value={currency}>{currency}</option>
                        )}
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                    </SelectControl>
                </p>
                <p>
                    <label htmlFor="product-interval">Abrechnungsintervall — wie wird bezahlt?</label>
                    <br />
                    <SelectControl
                        id="product-interval"
                        onChange={(event) =>
                            setBillingInterval(event.target.value as BillingInterval)
                        }
                        value={billingInterval}
                    >
                        <option value="MONTH">Monatlich — Abo, Zugang nur solange aktiv</option>
                        <option value="YEAR">Jährlich — Abo, Zugang nur solange aktiv</option>
                        <option value="ONE_TIME">Einmalig — dauerhafter Zugang nach Zahlung</option>
                    </SelectControl>
                    {billingInterval === 'ONE_TIME' ? (
                        <span className="mt-1 block text-sm text-muted-foreground">
                            Einmalzahlung bleibt gültig, bis du sie unter Zahlungen beendest
                            oder die Zahlung in Stripe vollständig erstattet wird.
                        </span>
                    ) : null}
                </p>
                {!isNew ? (
                    <p>
                        <label>
                            <Input
                                checked={active}
                                onChange={(event) =>
                                    setActive(event.target.checked)
                                }
                                className="size-4 shrink-0" type="checkbox"
                            />{' '}
                            Aktiv
                        </label>
                    </p>
                ) : null}
                <p>
                    <Button disabled={isSaving} type="submit">
                        {isSaving ? 'Speichern…' : 'Speichern'}
                    </Button>
                    {!isNew ? (
                        <>
                            {' '}
                            <Button
                                disabled={isSaving}
                                onClick={() => void handleSyncStripe()}
                                type="button"
                                variant="outline"
                            >
                                Mit Stripe synchronisieren
                            </Button>
                        </>
                    ) : null}
                    {!isNew && active ? (
                        <>
                            {' '}
                            <Button
                                disabled={isSaving}
                                onClick={() => void handleDeactivate()}
                                type="button"
                            >
                                Deaktivieren
                            </Button>
                        </>
                    ) : null}
                </p>
            </form>

            {!isNew && product !== null ? (
                <p className="text-sm text-muted-foreground">
                    {formatMoney(product.priceCents, product.currency, product.billingInterval)}
                    {product.stripePriceId !== null ? ' · Stripe-Preis vorhanden' : ' · noch nicht mit Stripe synchronisiert'}
                </p>
            ) : null}

            {!isNew && product?.offeringType === 'PACKAGE' ? (
                <ProductRulesEditor productId={product.id} />
            ) : null}
        </div>
    )
}
