'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import {subscribeToNewsletter} from '@/lib/api/newsletterApi'

interface NewsletterSubscribeFormProps {
    listSlug: string
}

export default function NewsletterSubscribeForm({
    listSlug,
}: NewsletterSubscribeFormProps): React.JSX.Element {
    const [email, setEmail] = useState('')
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

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
            onSubmit={(event) => {
                event.preventDefault()
                setBusy(true)
                setError(null)
                void subscribeToNewsletter({
                    listSlug,
                    email: email.trim(),
                })
                    .then(() => setDone(true))
                    .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : 'Fehler')
                    })
                    .finally(() => setBusy(false))
            }}
        >
            <label className="grid gap-1 text-sm font-medium">
                E-Mail
                <Input
                    autoComplete="email"
                    disabled={busy}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    required
                    type="email"
                    value={email}
                />
            </label>
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <Button disabled={busy} type="submit">
                Abonnieren
            </Button>
        </form>
    )
}
