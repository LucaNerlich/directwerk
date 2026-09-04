'use client'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState, type FormEvent} from 'react'

import ProductRulesEditor from '@/components/manage/ProductRulesEditor'
import {parsePriceEurosToCents} from '@/lib/manage/productPrice'
import {createProduct, deactivateProduct, listProducts, syncProductStripe, updateProduct} from '@/lib/api/subscriptionApi'
import type {BillingInterval, OfferingType, SubscriptionProduct} from '@directwerk/api/types'
import {formatMoney} from '@directwerk/api/format'
import {getClientTenantHost} from '@directwerk/api/tenant'
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
        const parsedPrice = parsePriceEurosToCents(priceEuros)
        if (!parsedPrice.valid) {
            setErrorMessage(parsedPrice.message)
            setIsSaving(false)
            return
        }
        const priceCents = parsedPrice.priceCents

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
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
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
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Stripe-Synchronisation fehlgeschlagen.',
            )
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
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Deaktivierung fehlgeschlagen.',
            )
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Abos"
                    title={isNew ? 'Neues Produkt' : 'Produkt bearbeiten'}
                    description="Titel, Typ, Preis und Abrechnungsintervall bestimmen, was Hörerinnen und Hörer kaufen."
                />
                <p className="text-sm text-muted-foreground" role="status">Laden…</p>
                <Skeleton className="h-64 w-full max-w-2xl" />
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow="Abos"
                title={isNew ? 'Neues Produkt' : 'Produkt bearbeiten'}
                description="Typ bestimmt, was das Produkt freischaltet. Abrechnungsintervall bestimmt, wie bezahlt wird."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/products" />} variant="outline">
                        Zurück zur Liste
                    </Button>
                }
            />

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

            <form className="flex w-full max-w-2xl flex-col gap-6" onSubmit={(event) => void handleSubmit(event)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Grundlagen</CardTitle>
                        <CardDescription>Name, Kennung und Typ des Produkts.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="product-title">Titel</Label>
                    <Input
                        aria-describedby="product-title-help"
                        id="product-title"
                        maxLength={255}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="z. B. Supporter"
                        required
                        type="text"
                        value={title}
                    />
                    <p className="text-xs text-muted-foreground" id="product-title-help">
                        Öffentlicher Name im Checkout und in E-Mails.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-slug">Slug</Label>
                    <Input
                        aria-describedby="product-slug-help"
                        disabled={!isNew}
                        id="product-slug"
                        maxLength={64}
                        onChange={(event) => setSlug(event.target.value)}
                        pattern={HTML_SLUG_PATTERN}
                        placeholder="z. B. supporter"
                        required={isNew}
                        type="text"
                        value={slug}
                    />
                    <p className="text-xs text-muted-foreground" id="product-slug-help">
                        Technische Kennung aus Kleinbuchstaben, Zahlen und Bindestrichen.
                        {isNew ? ' Wird aus dem Titel vorgeschlagen, wenn du sie leer lässt.' : ' Nach dem Anlegen nicht mehr änderbar.'}
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-offering">Typ — was wird freigeschaltet?</Label>
                    <SelectControl
                        aria-describedby="product-offering-help"
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
                    <p className="text-xs text-muted-foreground" id="product-offering-help">
                        {offeringType === 'PACKAGE'
                            ? 'Nach dem Speichern Regeln setzen. Ohne Regeln schaltet ein Paket nichts frei.'
                            : 'Stufen vergleichen die Sortierzahl mit der Mindest-Stufe: Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist.'}
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-sort">Sortierzahl der Stufe</Label>
                    <Input
                        aria-describedby="product-sort-help"
                        id="product-sort"
                        min={0}
                        onChange={(event) => setSortOrder(event.target.value)}
                        type="number"
                        value={sortOrder}
                    />
                    <p className="text-xs text-muted-foreground" id="product-sort-help">
                        Höhere Zahl = höhere Stufe (z. B. 10 Fan, 20 Supporter).
                        Zugriff auf bezahlte Inhalte hat, wessen höchste Stufe ≥ Mindest-Stufe der Folge oder des Formats ist.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-description">Beschreibung</Label>
                    <Input
                        aria-describedby="product-description-help"
                        id="product-description"
                        maxLength={2000}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Optional — erscheint im Checkout"
                        type="text"
                        value={description}
                    />
                    <p className="text-xs text-muted-foreground" id="product-description-help">
                        Optional. Kurz erklären, was enthalten ist.
                    </p>
                </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Preis &amp; Abrechnung</CardTitle>
                        <CardDescription>Betrag, Währung und Laufzeit für den Stripe-Checkout.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="product-price">Preis</Label>
                    <Input
                        aria-describedby="product-price-help"
                        id="product-price"
                        inputMode="decimal"
                        onChange={(event) => setPriceEuros(event.target.value)}
                        placeholder="z. B. 14,90"
                        type="text"
                        value={priceEuros}
                    />
                    <p className="text-xs text-muted-foreground" id="product-price-help">
                        Betrag in der gewählten Währung, z. B. 14,90. Ohne Preis kein Stripe-Checkout.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-currency">Währung</Label>
                    <SelectControl
                        id="product-currency"
                        onChange={(event) => setCurrency(event.target.value)}
                        value={currency}
                    >
                        {['EUR', 'USD', 'GBP'].includes(currency) ? null : (
                            <option value={currency}>{currency}</option>
                        )}
                        <option value="EUR">EUR — Euro</option>
                        <option value="USD">USD — US-Dollar</option>
                        <option value="GBP">GBP — Britisches Pfund</option>
                    </SelectControl>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-interval">Abrechnungsintervall — wie wird bezahlt?</Label>
                    <SelectControl
                        aria-describedby="product-interval-help"
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
                        <p className="text-xs text-muted-foreground" id="product-interval-help">
                            Einmalzahlung bleibt gültig, bis du sie unter Zahlungen beendest
                            oder die Zahlung in Stripe vollständig erstattet wird.
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground" id="product-interval-help">
                            Abos enden automatisch bei Kündigung oder fehlgeschlagener Zahlung.
                        </p>
                    )}
                </div>
                {!isNew ? (
                    <Label className="flex items-center gap-2 font-normal">
                        <Checkbox
                            checked={active}
                            id="product-active"
                            onCheckedChange={(checked) => setActive(checked === true)}
                        />
                        <span>Aktiv <span className="text-muted-foreground">(inaktive Produkte sind nicht kaufbar)</span></span>
                    </Label>
                ) : null}
                    </CardContent>
                </Card>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={isSaving} type="submit">
                        {isSaving ? 'Speichern…' : 'Speichern'}
                    </Button>
                    {!isNew ? (
                        <>
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
                            <Button
                                disabled={isSaving}
                                onClick={() => void handleDeactivate()}
                                type="button"
                                variant="outline"
                            >
                                Deaktivieren
                            </Button>
                        </>
                    ) : null}
                </div>
            </form>

            {!isNew && product !== null ? (
                <Card className="max-w-2xl">
                    <CardContent className="flex flex-wrap items-center gap-2 pt-6 text-sm text-muted-foreground">
                        <span>{formatMoney(product.priceCents, product.currency, product.billingInterval)}</span>
                        <Badge variant={product.stripePriceId !== null ? 'default' : 'outline'}>
                            {product.stripePriceId !== null ? 'Stripe-Preis vorhanden' : 'noch nicht mit Stripe synchronisiert'}
                        </Badge>
                    </CardContent>
                </Card>
            ) : null}

            {!isNew && product?.offeringType === 'PACKAGE' ? (
                <ProductRulesEditor productId={product.id} />
            ) : null}
        </PageStack>
    )
}
