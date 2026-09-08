'use client'

import {useSearchParams} from 'next/navigation'
import {useEffect, useState, Suspense} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {unsubscribeFromNewsletter} from '@/lib/api/newsletterApi'

function UnsubscribeInner(): React.JSX.Element {
    const params = useSearchParams()
    const token = params.get('token')
    const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

    useEffect(() => {
        if (token === null || token.length === 0) {
            setStatus('error')
            return
        }
        void unsubscribeFromNewsletter({token})
            .then(() => setStatus('ok'))
            .catch(() => setStatus('error'))
    }, [token])

    return (
        <PageStack>
            <PageHeader title="Newsletter abbestellen" />
            {status === 'loading' ? <p className="text-sm text-muted-foreground">Abbestellen…</p> : null}
            {status === 'ok' ? (
                <Alert>
                    <AlertDescription>Du wurdest abgemeldet. Keine weiteren Newsletter-Mails.</AlertDescription>
                </Alert>
            ) : null}
            {status === 'error' ? (
                <Alert variant="destructive">
                    <AlertDescription>Abbestellen fehlgeschlagen oder Link ungültig.</AlertDescription>
                </Alert>
            ) : null}
        </PageStack>
    )
}

export default function NewsletterUnsubscribePage(): React.JSX.Element {
    return (
        <Suspense fallback={<p className="p-6 text-sm">Laden…</p>}>
            <UnsubscribeInner />
        </Suspense>
    )
}
