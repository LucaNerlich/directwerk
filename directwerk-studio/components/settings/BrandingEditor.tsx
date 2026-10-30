'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import BrandTheme from '@directwerk/ui/components/brand-theme'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import Form from 'next/form'
import {useRouter} from 'next/navigation'

import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
import {useActionState, useCallback, useEffect, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import {getBranding, getContactEmail, updateBranding, updateContactEmail} from '@/lib/api/tenantSettingsApi'
import {uploadMediaFile} from '@/lib/media/upload'
import type {TenantBranding} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {isValidEmail} from '@directwerk/api/validation/input'
import {safeImageSrc} from '@/lib/url/safeUrl'
import {useDictionary} from '@/components/i18n/LocaleProvider'

interface BrandingFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: BrandingFormState = {error: null, success: null}

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

function normalizeColor(value: FormDataEntryValue | null): string | null | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return null
    }
    return text
}

// Native color inputs require a valid #rrggbb value at all times, so map
// empty/invalid drafts to a neutral fallback. The fallback never leaks into
// the submitted text field — only an explicit pick updates the draft.
const COLOR_PICKER_FALLBACK = '#000000'

function colorPickerValue(draft: string): string {
    return COLOR_PATTERN.test(draft) ? draft.toLowerCase() : COLOR_PICKER_FALLBACK
}

export default function BrandingEditor(): React.JSX.Element {
    const dict = useDictionary()
    const router = useRouter()
    const localize = useLocalizedPath()
    const authRedirect = useAuthRequired()
    const [branding, setBranding] = useState<TenantBranding | null>(null)
    const [contactEmail, setContactEmail] = useState<string | null>(null)
    const [primaryColorDraft, setPrimaryColorDraft] = useState('')
    const [secondaryColorDraft, setSecondaryColorDraft] = useState('')
    const [logoUrlDraft, setLogoUrlDraft] = useState('')
    const [logoPickError, setLogoPickError] = useState<string | null>(null)
    const [faviconUrlDraft, setFaviconUrlDraft] = useState('')
    const [faviconPickError, setFaviconPickError] = useState<string | null>(null)
    const [isFaviconUploading, setIsFaviconUploading] = useState(false)
    const [faviconUpload, setFaviconUpload] = useState<{file: File; progress: number} | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const mountedRef = useRef(true)
    const brandingRef = useRef<TenantBranding | null>(null)

    const handleAuthRequired = useCallback(() => {
        router.replace(localize('/login'))
    }, [localize, router])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    useEffect(() => {
        let active = true

        Promise.all([getBranding(), getContactEmail()])
            .then(([brandingResult, contactResult]) => {
                if (!active) {
                    return
                }
                setBranding(brandingResult)
                brandingRef.current = brandingResult
                setContactEmail(contactResult.contactEmail)
                setPrimaryColorDraft(brandingResult.primaryColor ?? '')
                setSecondaryColorDraft(brandingResult.secondaryColor ?? '')
                setLogoUrlDraft(brandingResult.logoUrl ?? '')
                setFaviconUrlDraft(brandingResult.faviconUrl ?? '')
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Branding konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [authRedirect, router])

    async function handleFaviconUpload(file: File | null): Promise<void> {
        if (file === null) {
            return
        }
        setFaviconPickError(null)
        setIsFaviconUploading(true)
        setFaviconUpload({file, progress: 0})
        try {
            const asset = await uploadMediaFile(getClientTenantHost(), file, {
                assetType: 'IMAGE',
                visibility: 'PUBLIC',
                onProgress: (percent) => {
                    if (mountedRef.current) {
                        setFaviconUpload({file, progress: percent})
                    }
                },
            })
            if (!mountedRef.current) {
                return
            }
            const src = safeImageSrc(asset.cdnUrl)
            if (src === null) {
                setFaviconPickError(
                    'Das hochgeladene Bild hat keine öffentliche HTTPS-URL. Wähle ein anderes oder gib eine URL ein.',
                )
                return
            }
            setFaviconUrlDraft(src)
        } catch (error: unknown) {
            if (!mountedRef.current) {
                return
            }
            if (authRedirect(error)) return
            setFaviconPickError(
                error instanceof Error ? error.message : 'Favicon-Upload fehlgeschlagen.',
            )
        } finally {
            if (mountedRef.current) {
                setIsFaviconUploading(false)
                setFaviconUpload(null)
            }
        }
    }

    async function saveAction(
        _previous: BrandingFormState,
        formData: FormData,
    ): Promise<BrandingFormState> {
        const siteTitle = String(formData.get('siteTitle') ?? '').trim()
        const primaryColor = normalizeColor(formData.get('primaryColor'))
        const secondaryColor = normalizeColor(formData.get('secondaryColor'))
        const logoUrl = logoUrlDraft.trim()
        const faviconUrl = faviconUrlDraft.trim()
        const contactEmailValue = String(formData.get('contactEmail') ?? '').trim()

        if (primaryColor !== null && primaryColor !== undefined && !COLOR_PATTERN.test(primaryColor)) {
            return {error: 'Primärfarbe muss #RRGGBB sein.', success: null}
        }
        if (
            secondaryColor !== null &&
            secondaryColor !== undefined &&
            !COLOR_PATTERN.test(secondaryColor)
        ) {
            return {error: 'Sekundärfarbe muss #RRGGBB sein.', success: null}
        }
        if (logoUrl.length > 0 && safeImageSrc(logoUrl) === null) {
            return {
                error: 'Logo-URL muss eine absolute https://-URL sein.',
                success: null,
            }
        }
        if (faviconUrl.length > 0 && safeImageSrc(faviconUrl) === null) {
            return {
                error: 'Favicon-URL muss eine absolute https://-URL sein.',
                success: null,
            }
        }
        if (contactEmailValue.length === 0) {
            return {
                error: dict.settings.kontaktEMailErforderlich,
                success: null,
            }
        }
        if (!isValidEmail(contactEmailValue)) {
            return {
                error: dict.settings.kontaktEMailUngueltig,
                success: null,
            }
        }

        try {
            // Preserve Umami fields — they are edited on the Advanced tab.
            const [updated, contactUpdated] = await Promise.all([
                updateBranding({
                    siteTitle: siteTitle.length > 0 ? siteTitle : '',
                    primaryColor: primaryColor ?? null,
                    secondaryColor: secondaryColor ?? null,
                    logoUrl: logoUrl.length > 0 ? logoUrl : null,
                    faviconUrl: faviconUrl.length > 0 ? faviconUrl : null,
                    umamiWebsiteId: brandingRef.current?.umamiWebsiteId ?? '',
                    umamiHostUrl: brandingRef.current?.umamiHostUrl ?? '',
                }),
                updateContactEmail({
                    contactEmail: contactEmailValue,
                }),
            ])
            setBranding(updated)
            brandingRef.current = updated
            setContactEmail(contactUpdated.contactEmail)
            setPrimaryColorDraft(updated.primaryColor ?? '')
            setSecondaryColorDraft(updated.secondaryColor ?? '')
            setLogoUrlDraft(updated.logoUrl ?? '')
            setFaviconUrlDraft(updated.faviconUrl ?? '')
            setLogoPickError(null)
            setFaviconPickError(null)
            return {
                error: null,
                success: dict.settings.brandingGespeichertAnalyticsEigenenUmamiSer,
            }
        } catch (error: unknown) {
            if (authRedirect(error)) return INITIAL_STATE
            return {
                error:
                    error instanceof Error
                        ? error.message
                        : dict.settings.brandingKonnteGespeichert,
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    // Live preview from drafts (falling back to saved values): admins see where
    // both colors land before saving.
    const previewPrimary =
        primaryColorDraft.trim().length > 0 ? primaryColorDraft : (branding?.primaryColor ?? null)
    const previewSecondary =
        secondaryColorDraft.trim().length > 0 ? secondaryColorDraft : (branding?.secondaryColor ?? null)
    const logoPreviewSrc = safeImageSrc(logoUrlDraft)
    const faviconPreviewSrc = safeImageSrc(faviconUrlDraft)

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={dict.nav.verwaltung.settings}
                    title="Branding"
                    description={dict.settings.titelFarbenLogoFaviconAnalyticsOeffentliche}
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <Skeleton className="h-96 w-full max-w-xl" />
            </PageStack>
        )
    }

    if (loadError !== null) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={dict.nav.verwaltung.settings}
                    title="Branding"
                    description={dict.settings.titelFarbenLogoFaviconAnalyticsOeffentliche}
                />
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.settings}
                title="Branding"
                description={dict.settings.titelFarbenLogoFaviconAnalyticsFuer}
            />

            <Form action={formAction} className="grid w-full max-w-xl gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Website &amp; Farben</CardTitle>
                        <CardDescription>So erscheint deine Seite für Hörerinnen und Hörer.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="siteTitle">Seitentitel</Label>
                    <Input
                        aria-describedby="siteTitle-help"
                        defaultValue={branding?.siteTitle ?? ''}
                        id="siteTitle"
                        maxLength={255}
                        name="siteTitle"
                        placeholder={dict.settings.oeffentlicherTitelWebsite}
                        type="text"
                    />
                    <p className="text-xs text-muted-foreground" id="siteTitle-help">
                        Leer lassen, um den Standard-Titel zu verwenden.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="primaryColor">Primärfarbe</Label>
                    <div className="flex items-center gap-3">
                        <Input
                            aria-label={dict.settings.primaerfarbeFarbwaehler}
                            className="size-9 shrink-0 cursor-pointer p-1"
                            onChange={(event) => setPrimaryColorDraft(event.target.value)}
                            type="color"
                            value={colorPickerValue(primaryColorDraft)}
                        />
                    <Input
                        aria-describedby="primaryColor-help"
                        id="primaryColor"
                        maxLength={7}
                        name="primaryColor"
                        onChange={(event) => setPrimaryColorDraft(event.target.value)}
                        placeholder="#1a1a1a"
                        type="text"
                        value={primaryColorDraft}
                    />
                    </div>
                    <p className="text-xs text-muted-foreground" id="primaryColor-help">
                        Farbwähler nutzen oder Hex-Wert im Format #RRGGBB eingeben, z. B. #1a1a1a. Leer lassen für die Standardfarbe. Aktuell: {branding?.primaryColor ?? 'Standard'}.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="secondaryColor">Sekundärfarbe</Label>
                    <div className="flex items-center gap-3">
                        <Input
                            aria-label={dict.settings.sekundaerfarbeFarbwaehler}
                            className="size-9 shrink-0 cursor-pointer p-1"
                            onChange={(event) => setSecondaryColorDraft(event.target.value)}
                            type="color"
                            value={colorPickerValue(secondaryColorDraft)}
                        />
                    <Input
                        aria-describedby="secondaryColor-help"
                        id="secondaryColor"
                        maxLength={7}
                        name="secondaryColor"
                        onChange={(event) => setSecondaryColorDraft(event.target.value)}
                        placeholder="#445566"
                        type="text"
                        value={secondaryColorDraft}
                    />
                    </div>
                    <p className="text-xs text-muted-foreground" id="secondaryColor-help">
                        Farbwähler nutzen oder Hex-Wert im Format #RRGGBB eingeben, z. B. #445566. Leer lassen für die Standardfarbe.
                    </p>
                </div>
                <div className="grid gap-3">
                    <div className="grid gap-2">
                        <p className="text-sm font-medium">Logo</p>
                        {logoPreviewSrc !== null ? (
                            <img
                                alt="Logo-Vorschau"
                                className="h-12 w-auto max-w-48 object-contain"
                                src={logoPreviewSrc}
                            />
                        ) : null}
                        <MediaLibraryPicker
                            assetType="IMAGE"
                            disabled={pending}
                            label={dict.settings.logoMediathek}
                            onAuthRequired={handleAuthRequired}
                            onSelect={(asset) => {
                                const src = safeImageSrc(asset.cdnUrl)
                                if (src === null) {
                                    setLogoPickError(
                                        'Dieses Bild hat keine öffentliche HTTPS-URL. Wähle ein anderes oder gib eine URL ein.',
                                    )
                                    return
                                }
                                setLogoPickError(null)
                                setLogoUrlDraft(src)
                            }}
                            selectedId={null}
                        />
                        {logoPickError !== null ? (
                            <p className="text-sm text-destructive" role="alert">
                                {logoPickError}
                            </p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="logoUrl">Oder Logo-URL</Label>
                        <Input
                            aria-describedby="logoUrl-help"
                            id="logoUrl"
                            maxLength={2048}
                            name="logoUrl"
                            onChange={(event) => {
                                setLogoPickError(null)
                                setLogoUrlDraft(event.target.value)
                            }}
                            placeholder="https://…"
                            type="url"
                            value={logoUrlDraft}
                        />
                        <p className="text-xs text-muted-foreground" id="logoUrl-help">
                            Bild aus der Mediathek wählen oder absolute https-URL eingeben. Leer lassen für kein Logo.
                        </p>
                        {logoUrlDraft.length > 0 ? (
                            <Button
                                disabled={pending}
                                onClick={() => {
                                    setLogoPickError(null)
                                    setLogoUrlDraft('')
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                Logo entfernen
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="grid gap-3">
                    <div className="grid gap-2">
                        <p className="text-sm font-medium">Favicon</p>
                        {faviconPreviewSrc !== null ? (
                            <img
                                alt="Favicon-Vorschau"
                                className="size-8 rounded-sm object-contain"
                                src={faviconPreviewSrc}
                            />
                        ) : null}
                        <Input
                            accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
                            aria-label="Favicon hochladen"
                            disabled={pending || isFaviconUploading}
                            onChange={(event) => {
                                const file = event.target.files?.[0] ?? null
                                void handleFaviconUpload(file)
                                event.target.value = ''
                            }}
                            type="file"
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            Quadratisch, z. B. 32 × 32 px als PNG oder ICO.
                        </span>
                        <MediaLibraryPicker
                            assetType="IMAGE"
                            disabled={pending || isFaviconUploading}
                            label={dict.settings.faviconMediathek}
                            onAuthRequired={handleAuthRequired}
                            onSelect={(asset) => {
                                const src = safeImageSrc(asset.cdnUrl)
                                if (src === null) {
                                    setFaviconPickError(
                                        'Dieses Bild hat keine öffentliche HTTPS-URL. Wähle ein anderes oder gib eine URL ein.',
                                    )
                                    return
                                }
                                setFaviconPickError(null)
                                setFaviconUrlDraft(src)
                            }}
                            selectedId={null}
                        />
                        {faviconUpload !== null ? (
                            <UploadProgress
                                file={faviconUpload.file}
                                progress={faviconUpload.progress}
                            />
                        ) : null}
                        {faviconPickError !== null ? (
                            <p className="text-sm text-destructive" role="alert">
                                {faviconPickError}
                            </p>
                        ) : null}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="faviconUrl">Oder Favicon-URL</Label>
                        <Input
                            aria-describedby="faviconUrl-help"
                            disabled={pending || isFaviconUploading}
                            id="faviconUrl"
                            maxLength={2048}
                            name="faviconUrl"
                            onChange={(event) => {
                                setFaviconPickError(null)
                                setFaviconUrlDraft(event.target.value)
                            }}
                            placeholder="https://…"
                            type="url"
                            value={faviconUrlDraft}
                        />
                        <p className="text-xs text-muted-foreground" id="faviconUrl-help">
                            Wird als Browser-Tab-Symbol deiner öffentlichen Website verwendet. Leer lassen für Logo bzw. Standard.
                        </p>
                        {faviconUrlDraft.length > 0 ? (
                            <Button
                                disabled={pending || isFaviconUploading}
                                onClick={() => {
                                    setFaviconPickError(null)
                                    setFaviconUrlDraft('')
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                Favicon entfernen
                            </Button>
                        ) : null}
                    </div>
                </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{dict.settings.podcastKontakt}</CardTitle>
                        <CardDescription>{dict.settings.podcastKontaktBeschreibung}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="contactEmail">
                                {dict.settings.kontaktEMail}{' '}
                                <span className="font-normal text-muted-foreground">
                                    ({dict.common.required})
                                </span>
                            </Label>
                            <Input
                                aria-describedby="contactEmail-help"
                                aria-required="true"
                                defaultValue={contactEmail ?? ''}
                                id="contactEmail"
                                key={contactEmail ?? ''}
                                maxLength={255}
                                name="contactEmail"
                                placeholder="podcast@example.com"
                                required
                                type="email"
                            />
                            <p className="text-xs text-muted-foreground" id="contactEmail-help">
                                {dict.settings.kontaktEMailHilfe}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                {state.error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                ) : null}
                {state.success ? (
                    <Alert role="status">
                        <AlertDescription>{state.success}</AlertDescription>
                    </Alert>
                ) : null}
                <div className="grid gap-2">
                    <p className="text-sm font-medium" id="branding-preview-label">Vorschau</p>
                    <BrandTheme primaryHex={previewPrimary} secondaryHex={previewSecondary}>
                        <div
                            aria-labelledby="branding-preview-label"
                            className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-4"
                        >
                            <Button type="button">Primär</Button>
                            <Button type="button" variant="secondary">
                                Sekundär
                            </Button>
                            <span className="text-sm font-medium text-primary">
                                Akzent-Text
                            </span>
                        </div>
                    </BrandTheme>
                    <p className="text-xs text-muted-foreground">
                        Live-Vorschau aus deinen Entwürfen — nach dem Speichern gelten die Farben für Studio und Website.
                    </p>
                </div>
                <div>
                <Button disabled={pending || isFaviconUploading} type="submit">
                    {pending ? 'Speichern…' : 'Speichern'}
                </Button>
                </div>
            </Form>
        </PageStack>
    )
}
