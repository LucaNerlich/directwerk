'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import type {PublicNewsletterList} from '@directwerk/api/types'

import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm'
import {getPublicNewsletterList} from '@/lib/api/publicApi'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

interface NewsletterSubscribePageClientProps {
    list: PublicNewsletterList | null
    slug: string
}

type LoadState =
    | {kind: 'ready'; list: PublicNewsletterList}
    | {kind: 'missing'}
    | {kind: 'fallback'}
    | {kind: 'loading'}

export default function NewsletterSubscribePageClient({
    list: initialList,
    slug,
}: NewsletterSubscribePageClientProps): React.JSX.Element {
    const lang = useLocale()
    const {newsletter} = useDictionary()
    const config = useSiteConfig()
    const emailNotify = config.emailNotifyAvailable === true
    const [state, setState] = useState<LoadState>(() => {
        if (initialList !== null) {
            return {kind: 'ready', list: initialList}
        }
        return emailNotify ? {kind: 'loading'} : {kind: 'fallback'}
    })

    useEffect(() => {
        if (initialList !== null || !emailNotify) {
            return
        }
        let cancelled = false
        setState({kind: 'loading'})
        void getPublicNewsletterList(slug)
            .then((row) => {
                if (cancelled) {
                    return
                }
                setState(row === null ? {kind: 'missing'} : {kind: 'ready', list: row})
            })
            .catch(() => {
                if (!cancelled) {
                    // Catalog GET not deployed yet — share links still work via subscribe.
                    setState({kind: 'fallback'})
                }
            })
        return () => {
            cancelled = true
        }
    }, [emailNotify, initialList, slug])

    if (!emailNotify) {
        return (
            <PageStack className="page-container">
                <PageHeader title={newsletter.title} description={newsletter.inactive} />
            </PageStack>
        )
    }

    if (state.kind === 'loading') {
        return (
            <PageStack className="page-container">
                <PageHeader title={newsletter.title} description={newsletter.listLoading} />
                <Skeleton className="h-24 max-w-md w-full" />
            </PageStack>
        )
    }

    if (state.kind === 'missing') {
        return (
            <PageStack className="page-container">
                <PageHeader
                    title={newsletter.listNotFoundTitle}
                    description={newsletter.listNotFoundDescription}
                    actions={
                        <Button nativeButton={false} render={<Link href={localizedPath(lang, '/newsletter')} />} variant="outline">
                            {newsletter.allLists}
                        </Button>
                    }
                />
            </PageStack>
        )
    }

    const title = state.kind === 'ready' ? state.list.name : newsletter.subscribeTitle
    const description =
        state.kind === 'ready'
            ? state.list.description?.trim() || newsletter.confirmHint
            : newsletter.confirmHint

    return (
        <PageStack className="page-container">
            <PageHeader
                title={title}
                description={description}
                actions={
                    <Button nativeButton={false} render={<Link href={localizedPath(lang, '/newsletter')} />} variant="outline">
                        {newsletter.allLists}
                    </Button>
                }
            />
            <NewsletterSubscribeForm listSlug={slug} />
        </PageStack>
    )
}
