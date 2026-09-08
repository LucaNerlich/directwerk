'use client'

import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {subscribeToNewsletter} from '@/lib/api/newsletterApi'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function NewsletterSubscribePage(): React.JSX.Element {
    const config = useSiteConfig()
    const emailNotify = config.emailNotifyAvailable === true
    const [slug, setSlug] = useState('')
    const [email, setEmail] = useState('')
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    if (!emailNotify) {
        return (
            <PageStack>
                <PageHeader title="Newsletter" description="Newsletter sind für diesen Tenant nicht aktiv." />
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                title="Newsletter abonnieren"
                description="Keine Anmeldung nötig. Du bekommst eine Bestätigungsmail."
            />
            {done ? (
                <Alert>
                    <AlertDescription>
                        Wenn die Adresse neu ist, schicken wir eine Bestätigungsmail. Bitte Posteingang prüfen.
                    </AlertDescription>
                </Alert>
            ) : (
                <form
                    className="grid max-w-md gap-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        setBusy(true)
                        setError(null)
                        void subscribeToNewsletter({
                            listSlug: slug.trim(),
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
                        Listen-Slug
                        <Input
                            disabled={busy}
                            onChange={(event) => setSlug(event.target.value)}
                            required
                            value={slug}
                        />
                    </label>
                    <label className="grid gap-1 text-sm font-medium">
                        E-Mail
                        <Input
                            disabled={busy}
                            onChange={(event) => setEmail(event.target.value)}
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
            )}
        </PageStack>
    )
}
