'use client'

import Link from 'next/link'
import {useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import AuthCard from '@directwerk/ui/components/auth-card'

import {verifyEmail} from '@/lib/api/client'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

type VerifyState = 'verifying' | 'success' | 'error' | 'missing'

function VerifyEmailContent() {
    const {auth, common} = useDictionary()
    const searchParams = useSearchParams()
    const tokenFromQuery = searchParams.get('token') ?? ''
    const [state, setState] = useState<VerifyState>(
        tokenFromQuery.length > 0 ? 'verifying' : 'missing',
    )
    const started = useRef(false)

    useEffect(() => {
        if (tokenFromQuery.length === 0 || started.current) {
            return
        }
        started.current = true
        let active = true
        verifyEmail(tokenFromQuery)
            .then(() => {
                if (active) {
                    setState('success')
                }
            })
            .catch(() => {
                // A double-invoked effect in development must not turn an
                // already-confirmed address back into an error.
                if (active) {
                    setState((current) => (current === 'verifying' ? 'error' : current))
                }
            })
        return () => {
            active = false
        }
    }, [tokenFromQuery])

    if (state === 'verifying') {
        return (
            <p role="status" className="text-sm text-muted-foreground">
                {auth.verifyPending}
            </p>
        )
    }

    return (
        <Alert variant={state === 'success' ? 'default' : 'destructive'} role="alert">
            <AlertDescription>
                {state === 'success'
                    ? auth.verifySuccess
                    : state === 'missing'
                      ? auth.verifyMissingToken
                      : auth.verifyInvalid}
            </AlertDescription>
        </Alert>
    )
}

export default function VerifyEmailPage() {
    const lang = useLocale()
    const {auth, common} = useDictionary()
    return (
        <AuthCard
            title={auth.verifyTitle}
            footer={
                <Link className="underline" href={localizedPath(lang, '/login')}>
                    {auth.resetToLogin}
                </Link>
            }
        >
            <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">{common.loading}</p>}>
                <VerifyEmailContent />
            </Suspense>
        </AuthCard>
    )
}
