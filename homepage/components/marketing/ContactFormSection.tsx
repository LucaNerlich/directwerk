'use client'

import {useState} from 'react'

import {Button, buttonVariants} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {Textarea} from '@directwerk/ui/components/textarea'

import AltchaWidget from '@/components/marketing/AltchaWidget'
import {useLocale} from '@/components/i18n/LocaleProvider'
import {hrefFor} from '@/lib/i18n/pathname'
import {API_URL} from '@/lib/marketing/constants'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

type AltchaElement = HTMLElement & {
    reset?: () => void
}

/**
 * Renders the contact form section for submitting inquiries.
 */
export default function ContactFormSection(): React.JSX.Element {
    const {lang, dictionary} = useLocale()
    const copy = dictionary.contact
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
            setErrorMessage(copy.captchaRequired)
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
                const known =
                    code && Object.prototype.hasOwnProperty.call(copy.errors, code)
                        ? copy.errors[code as keyof typeof copy.errors]
                        : undefined
                throw new Error(known ?? copy.errors.default)
            }

            form.reset()
            altchaWidget?.reset?.()
            setCaptchaVerified(false)
            setStatus('success')
        } catch (error) {
            setStatus('error')
            setErrorMessage(
                error instanceof Error ? error.message : copy.errors.default,
            )
        }
    }

    return (
        <section className="marketing-section" id="contact">
            <div className="marketing-container">
                <div className="rounded-2xl border bg-primary px-8 py-12 text-primary-foreground sm:px-12">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                        {copy.eyebrow}
                    </p>
                    <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight">
                        {copy.title}
                    </h2>
                    <p className="mt-4 max-w-lg text-primary-foreground/80">{copy.body}</p>

                    <form className="mt-8 grid max-w-xl gap-4" onSubmit={handleSubmit}>
                        <div className="grid gap-2">
                            <Label className="text-primary-foreground" htmlFor="contact-name">
                                {copy.name}
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
                                {copy.email}
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
                                {copy.message}
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
                                {copy.success}
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
                                {status === 'submitting' ? copy.submitting : copy.submit}
                            </Button>
                            <a
                                className={buttonVariants({
                                    variant: 'outline',
                                    size: 'lg',
                                    className:
                                        'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10',
                                })}
                                href={hrefFor(lang, '/developers')}
                            >
                                {copy.apiExcerpt}
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    )
}
