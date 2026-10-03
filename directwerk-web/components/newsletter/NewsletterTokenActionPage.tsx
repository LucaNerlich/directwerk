'use client'

import {useSearchParams} from 'next/navigation'
import {useEffect, useState, Suspense} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {useDictionary} from '@/lib/i18n/LocaleProvider'
import {
    confirmNewsletterSubscription,
    unsubscribeFromNewsletter,
} from '@/lib/api/newsletterApi'

type TokenActionStatus = 'loading' | 'ok' | 'error'

const RUNNERS = {
    confirm: (token: string) => confirmNewsletterSubscription({token}),
    unsubscribe: (token: string) => unsubscribeFromNewsletter({token}),
} as const

export function NewsletterTokenActionPage({
    action,
}: {
    action: keyof typeof RUNNERS
}): React.JSX.Element {
    const {newsletter} = useDictionary()
    return (
        <Suspense fallback={<p className="p-6 text-sm">{newsletter.loadingFallback}</p>}>
            <Inner action={action} />
        </Suspense>
    )
}

function Inner({action}: {action: keyof typeof RUNNERS}): React.JSX.Element {
    const {newsletter} = useDictionary()
    const copy =
        action === 'confirm'
            ? {
                  title: newsletter.confirmTitle,
                  loadingMessage: newsletter.confirmLoading,
                  okMessage: newsletter.confirmOk,
                  errorMessage: newsletter.confirmError,
              }
            : {
                  title: newsletter.unsubscribeTitle,
                  loadingMessage: newsletter.unsubscribeLoading,
                  okMessage: newsletter.unsubscribeOk,
                  errorMessage: newsletter.unsubscribeError,
              }
    const params = useSearchParams()
    const token = params.get('token')
    const [status, setStatus] = useState<TokenActionStatus>('loading')

    useEffect(() => {
        if (token === null || token.length === 0) {
            setStatus('error')
            return
        }
        void RUNNERS[action](token)
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
