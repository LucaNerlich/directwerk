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

import ProductRulesEditor from '@/components/manage/ProductRulesEditor'
import {parsePriceEurosToCents} from '@/lib/manage/productPrice'
import {createProduct, deactivateProduct, listProducts, syncProductStripe, updateProduct} from '@/lib/api/subscriptionApi'
import type {
    BillingInterval,
    CreateProductInput,
    OfferingType,
    SubscriptionProduct,
    UpdateProductInput,
} from '@directwerk/api/types'
import {formatMoney} from '@directwerk/api/format'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useResourceEditor} from '@/lib/hooks/useResourceEditor'

interface ProductEditorProps {
    productId?: number
}

interface ProductFormValues {
    title: string
    slug: string
    sortOrder: string
    offeringType: OfferingType
    description: string
    priceEuros: string
    currency: string
    billingInterval: BillingInterval
    active: boolean
}

const INITIAL_VALUES: ProductFormValues = {
    title: '',
    slug: '',
    sortOrder: '0',
    offeringType: 'LEVEL',
    description: '',
    priceEuros: '',
    currency: 'EUR',
    billingInterval: 'MONTH',
    active: true,
}

function toProductValues(product: SubscriptionProduct): ProductFormValues {
    return {
        title: product.title,
        slug: product.slug,
        sortOrder: String(product.sortOrder),
        offeringType: product.offeringType,
        description: product.description ?? '',
        priceEuros: product.priceCents !== null ? (product.priceCents / 100).toString() : '',
        currency: product.currency,
        billingInterval: product.billingInterval,
        active: product.active,
    }
}

function resolveSlug(values: ProductFormValues): string {
    return values.slug.trim() || suggestSlug(values.title) || 'produkt'
}

function parseSortOrder(values: ProductFormValues): number {
    const parsed = Number.parseInt(values.sortOrder, 10)
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

function parsePrice(values: ProductFormValues): number | undefined {
    const parsed = parsePriceEurosToCents(values.priceEuros)
    return parsed.valid ? parsed.priceCents : undefined
}

function validatePrice(values: ProductFormValues): string | null {
    const parsed = parsePriceEurosToCents(values.priceEuros)
    return parsed.valid ? null : parsed.message
}

export default function ProductEditor({
    productId,
}: ProductEditorProps): React.JSX.Element {
    const {
        entity: product,
        values,
        setField,
        isNew,
        isLoading,
        isSaving,
        isDeactivating,
        errorMessage,
        statusMessage,
        handleSubmit,
        handleDeactivate,
        runAction,
        applyEntity,
        setStatusMessage,
    } = useResourceEditor<
        SubscriptionProduct,
        ProductFormValues,
        CreateProductInput,
        UpdateProductInput
    >({
        id: productId,
        load: listProducts,
        create: createProduct,
        update: updateProduct,
        deactivate: deactivateProduct,
        initialValues: INITIAL_VALUES,
        toValues: toProductValues,
        validate: validatePrice,
        buildCreate: (current) => ({
            title: current.title.trim() || 'Ohne Titel',
            slug: resolveSlug(current),
            sortOrder: parseSortOrder(current),
            offeringType: current.offeringType,
            description: current.description.trim() || undefined,
            priceCents: parsePrice(current),
            currency: current.currency.trim().toUpperCase() || 'EUR',
            billingInterval: current.billingInterval,
        }),
        buildUpdate: (current) => ({
            title: current.title.trim() || 'Ohne Titel',
            sortOrder: parseSortOrder(current),
            active: current.active,
            description: current.description.trim(),
            priceCents: parsePrice(current),
            currency: current.currency.trim().toUpperCase() || 'EUR',
            billingInterval: current.billingInterval,
        }),
        redirectPath: (created) => `/manage/products/${created.id}`,
        updateSuccessMessage: 'Produkt gespeichert.',
        deactivateSuccessMessage: 'Produkt deaktiviert.',
        messages: {
            notFound: 'Produkt wurde nicht gefunden.',
            loadFailed: 'Produkt konnte nicht geladen werden.',
            saveFailed: 'Aktion fehlgeschlagen.',
            deactivateFailed: 'Deaktivierung fehlgeschlagen.',
        },
    })

    async function handleSyncStripe(): Promise<void> {
        if (productId === undefined) {
            return
        }
        await runAction(
            async () => {
                const updated = await syncProductStripe(getClientTenantHost(), productId)
                applyEntity(updated)
                setStatusMessage('Produkt mit Stripe synchronisiert.')
            },
            {failedMessage: 'Stripe-Synchronisation fehlgeschlagen.'},
        )
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
                        onChange={(event) => setField('title', event.target.value)}
                        placeholder="z. B. Supporter"
                        required
                        type="text"
                        value={values.title}
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
                        onChange={(event) => setField('slug', event.target.value)}
                        pattern={HTML_SLUG_PATTERN}
                        placeholder="z. B. supporter"
                        required={isNew}
                        type="text"
                        value={values.slug}
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
                            setField('offeringType', event.target.value as OfferingType)
                        }
                        value={values.offeringType}
                    >
                        <option value="LEVEL">Stufe — Leiter, höhere Zahl schließt niedrigere ein</option>
                        <option value="PACKAGE">Paket — nur die Inhalte aus den Regeln</option>
                    </SelectControl>
                    <p className="text-xs text-muted-foreground" id="product-offering-help">
                        {values.offeringType === 'PACKAGE'
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
                        onChange={(event) => setField('sortOrder', event.target.value)}
                        type="number"
                        value={values.sortOrder}
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
                        onChange={(event) => setField('description', event.target.value)}
                        placeholder="Optional — erscheint im Checkout"
                        type="text"
                        value={values.description}
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
                        onChange={(event) => setField('priceEuros', event.target.value)}
                        placeholder="z. B. 14,90"
                        type="text"
                        value={values.priceEuros}
                    />
                    <p className="text-xs text-muted-foreground" id="product-price-help">
                        Betrag in der gewählten Währung, z. B. 14,90. Ohne Preis kein Stripe-Checkout.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="product-currency">Währung</Label>
                    <SelectControl
                        id="product-currency"
                        onChange={(event) => setField('currency', event.target.value)}
                        value={values.currency}
                    >
                        {['EUR', 'USD', 'GBP'].includes(values.currency) ? null : (
                            <option value={values.currency}>{values.currency}</option>
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
                            setField('billingInterval', event.target.value as BillingInterval)
                        }
                        value={values.billingInterval}
                    >
                        <option value="MONTH">Monatlich — Abo, Zugang nur solange aktiv</option>
                        <option value="YEAR">Jährlich — Abo, Zugang nur solange aktiv</option>
                        <option value="ONE_TIME">Einmalig — dauerhafter Zugang nach Zahlung</option>
                    </SelectControl>
                    {values.billingInterval === 'ONE_TIME' ? (
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
                            checked={values.active}
                            id="product-active"
                            onCheckedChange={(checked) => setField('active', checked === true)}
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
                    {!isNew && values.active ? (
                        <>
                            <Button
                                disabled={isSaving || isDeactivating}
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
