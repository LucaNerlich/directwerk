'use client'

import {useSearchParams} from 'next/navigation'
import {useEffect, useState, Suspense} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {
    confirmNewsletterSubscription,
    unsubscribeFromNewsletter,
} from '@/lib/api/newsletterApi'

type TokenActionStatus = 'loading' | 'ok' | 'error'

const COPY = {
    confirm: {
        title: 'Newsletter bestätigen',
        loadingMessage: 'Bestätigen…',
        okMessage: 'Abo bestätigt. Du bekommst künftig Mails zu dieser Liste.',
        errorMessage: 'Bestätigung fehlgeschlagen oder Link ungültig.',
        run: (token: string) => confirmNewsletterSubscription({token}),
    },
    unsubscribe: {
        title: 'Newsletter abbestellen',
        loadingMessage: 'Abbestellen…',
        okMessage: 'Du wurdest abgemeldet. Keine weiteren Newsletter-Mails.',
        errorMessage: 'Abbestellen fehlgeschlagen oder Link ungültig.',
        run: (token: string) => unsubscribeFromNewsletter({token}),
    },
} as const

export function NewsletterTokenActionPage({
    action,
}: {
    action: keyof typeof COPY
}): React.JSX.Element {
    return (
        <Suspense fallback={<p className="p-6 text-sm">Laden…</p>}>
            <Inner action={action} />
        </Suspense>
    )
}

function Inner({action}: {action: keyof typeof COPY}): React.JSX.Element {
    const copy = COPY[action]
    const params = useSearchParams()
    const token = params.get('token')
    const [status, setStatus] = useState<TokenActionStatus>('loading')

    useEffect(() => {
        if (token === null || token.length === 0) {
            setStatus('error')
            return
        }
        void COPY[action]
            .run(token)
            .then(() => setStatus('ok'))
            .catch(() => setStatus('error'))
    }, [action, token])

    return (
        <PageStack className="page-container">
            <PageHeader title={copy.title} />
            {status === 'loading' ? (
                <p className="text-sm text-muted-foreground">{copy.loadingMessage}</p>
            ) : null}
            {status === 'ok' ? (
                <Alert>
                    <AlertDescription>{copy.okMessage}</AlertDescription>
                </Alert>
            ) : null}
            {status === 'error' ? (
                <Alert variant="destructive">
                    <AlertDescription>{copy.errorMessage}</AlertDescription>
                </Alert>
            ) : null}
        </PageStack>
    )
}
