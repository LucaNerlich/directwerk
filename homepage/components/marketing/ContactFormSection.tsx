'use client'

import {useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {Textarea} from '@directwerk/ui/components/textarea'

import AltchaWidget from '@/components/marketing/AltchaWidget'
import {API_URL} from '@/lib/marketing/constants'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

type AltchaElement = HTMLElement & {
    reset?: () => void
}

export default function ContactFormSection(): React.JSX.Element {
    const [status, setStatus] = useState<FormStatus>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [captchaVerified, setCaptchaVerified] = useState(false)
    const [altchaWidget, setAltchaWidget] = useState<AltchaElement | null>(null)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault()
        setStatus('submitting')
        setErrorMessage(null)

        const form = event.currentTarget
        const formData = new FormData(form)
        const altchaPayload = formData.get('altcha')

        if (typeof altchaPayload !== 'string' || altchaPayload.length === 0) {
            setStatus('error')
            setErrorMessage('Bitte bestätige die Sicherheitsprüfung.')
            return
        }

        try {
            const response = await fetch(`${API_URL}/api/v1/public/contact`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    message: formData.get('message'),
                    altcha: altchaPayload,
                }),
            })

            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as {
                    errors?: Array<{code?: string; message?: string}>
                } | null
                const code = body?.errors?.[0]?.code
                if (code === 'CAPTCHA_INVALID') {
                    throw new Error('Die Sicherheitsprüfung ist abgelaufen. Bitte erneut versuchen.')
                }
                if (code === 'CONTACT_FORM_DISABLED') {
                    throw new Error('Das Kontaktformular ist derzeit nicht verfügbar.')
                }
                if (code === 'RATE_LIMIT_EXCEEDED') {
                    throw new Error('Zu viele Anfragen. Bitte später erneut versuchen.')
                }
                throw new Error('Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.')
            }

            form.reset()
            altchaWidget?.reset?.()
            setCaptchaVerified(false)
            setStatus('success')
        } catch (error) {
            setStatus('error')
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.',
            )
        }
    }

    return (
        <section className="marketing-section" id="contact">
            <div className="marketing-container">
                <div className="rounded-2xl border bg-primary px-8 py-12 text-primary-foreground sm:px-12">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                        Bereit für den nächsten Schritt?
                    </p>
                    <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight">
                        Eigene Publishing-Infrastruktur — nicht nur ein weiteres CMS
                    </h2>
                    <p className="mt-4 max-w-lg text-primary-foreground/80">
                        Wir sprechen mit Creators, Agenturen und Integratoren über Early
                        Access, Migration von Patreon/Steady und Custom-Frontends.
                    </p>

                    <form className="mt-8 grid max-w-xl gap-4" onSubmit={handleSubmit}>
                        <div className="grid gap-2">
                            <Label className="text-primary-foreground" htmlFor="contact-name">
                                Name
                            </Label>
                            <Input
                                autoComplete="name"
                                className="border-primary-foreground/20 bg-primary-foreground text-primary"
                                id="contact-name"
                                maxLength={120}
                                name="name"
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-primary-foreground" htmlFor="contact-email">
                                E-Mail
                            </Label>
                            <Input
                                autoComplete="email"
                                className="border-primary-foreground/20 bg-primary-foreground text-primary"
                                id="contact-email"
                                maxLength={254}
                                name="email"
                                required
                                type="email"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-primary-foreground" htmlFor="contact-message">
                                Nachricht
                            </Label>
                            <Textarea
                                className="min-h-32 border-primary-foreground/20 bg-primary-foreground text-primary"
                                id="contact-message"
                                maxLength={5000}
                                name="message"
                                required
                            />
                        </div>

                        <div className="rounded-lg border border-primary-foreground/20 bg-primary-foreground/95 p-3 text-primary">
                            <AltchaWidget
                                onVerifiedChange={setCaptchaVerified}
                                widgetRef={setAltchaWidget}
                            />
                        </div>

                        {status === 'success' ? (
                            <p className="text-sm text-primary-foreground" role="status">
                                Danke — deine Nachricht ist unterwegs. Wir melden uns per E-Mail.
                            </p>
                        ) : null}

                        {status === 'error' && errorMessage ? (
                            <p className="text-sm text-red-200" role="alert">
                                {errorMessage}
                            </p>
                        ) : null}

                        <div className="flex flex-wrap gap-3">
                            <Button
                                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                                disabled={status === 'submitting' || !captchaVerified}
                                size="lg"
                                type="submit"
                            >
                                {status === 'submitting' ? 'Wird gesendet…' : 'Nachricht senden'}
                            </Button>
                            <Button
                                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                                render={<a href="/developers" />}
                                size="lg"
                                type="button"
                                variant="outline"
                            >
                                API-Auszug
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    )
}
