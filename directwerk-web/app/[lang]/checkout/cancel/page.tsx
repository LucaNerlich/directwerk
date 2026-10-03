import Link from 'next/link'
import {notFound} from 'next/navigation'

import {buttonVariants} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {isLocale} from '@/lib/i18n/config'
import {getDictionary} from '@/lib/i18n/getDictionary'
import {localizedPath} from '@/lib/i18n/paths'

export default async function CheckoutCancelPage({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<React.JSX.Element> {
    const {lang: langParam} = await params
    if (!isLocale(langParam)) {
        notFound()
    }
    const lang = langParam
    const {billing, nav} = await getDictionary(lang)
    return (
        <PageStack className="page-container">
            <PageHeader
                title={billing.cancelTitle}
                description={billing.cancelDescription}
            />
            <div className="flex flex-wrap gap-3">
                <Link className={buttonVariants()} href={localizedPath(lang, '/pricing')}>
                    {nav.backToPricing}
                </Link>
                <Link className={buttonVariants({variant: 'outline'})} href={localizedPath(lang, '/account')}>
                    {nav.toAccount}
                </Link>
            </div>
        </PageStack>
    )
}
