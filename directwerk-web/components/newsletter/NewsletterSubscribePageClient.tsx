'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import type {PublicNewsletterList} from '@directwerk/api/types'

import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

interface NewsletterSubscribePageClientProps {
    list: PublicNewsletterList | null
    slug: string
}

export default function NewsletterSubscribePageClient({
    list,
    slug,
}: NewsletterSubscribePageClientProps): React.JSX.Element {
    const config = useSiteConfig()
    const emailNotify = config.emailNotifyAvailable === true

    if (!emailNotify) {
        return (
            <PageStack>
                <PageHeader title="Newsletter" description="Newsletter sind für diesen Tenant nicht aktiv." />
            </PageStack>
        )
    }

    if (list === null) {
        return (
            <PageStack>
                <PageHeader
                    title="Newsletter nicht gefunden"
                    description="Diese Liste existiert nicht oder ist nicht mehr aktiv."
                    actions={
                        <Button nativeButton={false} render={<Link href="/newsletter" />} variant="outline">
                            Alle Listen
                        </Button>
                    }
                />
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                title={list.name}
                description={
                    list.description?.trim() ||
                    'Keine Anmeldung nötig. Du bekommst eine Bestätigungsmail.'
                }
                actions={
                    <Button nativeButton={false} render={<Link href="/newsletter" />} variant="outline">
                        Alle Listen
                    </Button>
                }
            />
            <NewsletterSubscribeForm listSlug={slug} />
        </PageStack>
    )
}
