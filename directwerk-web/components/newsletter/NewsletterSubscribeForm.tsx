'use client'

import {useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import {subscribeToNewsletter} from '@/lib/api/newsletterApi'
import {emailFieldError} from '@/lib/forms/authFields'

interface NewsletterSubscribeFormProps {
    listSlug: string
}

export default function NewsletterSubscribeForm({
    listSlug,
}: NewsletterSubscribeFormProps): React.JSX.Element {
    const [email, setEmail] = useState('')
    const [fieldError, setFieldError] = useState<string | undefined>(undefined)
    const [formError, setFormError] = useState<string | null>(null)
    const [done, setDone] = useState(false)
    const [busy, setBusy] = useState(false)
    const emailRef = useRef<HTMLInputElement>(null)

    if (done) {
        return (
            <Alert>
                <AlertDescription>
                    Wenn die Adresse neu ist, schicken wir eine Bestätigungsmail. Bitte Posteingang
                    prüfen.
                </AlertDescription>
            </Alert>
        )
    }

    return (
        <form
            className="grid max-w-md gap-3"
            noValidate
            onSubmit={(event) => {
                event.preventDefault()
                const invalid = emailFieldError(email)
                setFieldError(invalid)
                if (invalid !== undefined) {
                    emailRef.current?.focus()
                    return
                }
                setBusy(true)
                setFormError(null)
                void subscribeToNewsletter({
                    listSlug,
                    email: email.trim(),
                })
                    .then(() => setDone(true))
                    .catch(() => {
                        // Never surface raw API/transport text to a public
                        // visitor — keep the message generic.
                        setFormError(
                            'Abonnieren fehlgeschlagen. Bitte versuche es später erneut.',
                        )
                    })
                    .finally(() => setBusy(false))
            }}
        >
            <label className="grid gap-1 text-sm font-medium">
                E-Mail
                <Input
                    aria-describedby={fieldError !== undefined ? 'newsletter-email-error' : undefined}
                    aria-invalid={fieldError !== undefined || undefined}
                    autoComplete="email"
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com…"
                    ref={emailRef}
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                />
            </label>
            {fieldError !== undefined ? (
                <p className="text-xs text-destructive" id="newsletter-email-error">
                    {fieldError}
                </p>
            ) : null}
            {formError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{formError}</AlertDescription>
                </Alert>
            ) : null}
            <Button disabled={busy} type="submit">
                Abonnieren
            </Button>
        </form>
    )
}
