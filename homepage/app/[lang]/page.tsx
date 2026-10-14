import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import ContactFormSection from '@/components/marketing/ContactFormSection'
import DeveloperTeaserSection from '@/components/marketing/DeveloperTeaserSection'
import FaqSection from '@/components/marketing/FaqSection'
import FeedsSection from '@/components/marketing/FeedsSection'
import HeroSection from '@/components/marketing/HeroSection'
import LiveExampleSection from '@/components/marketing/LiveExampleSection'
import ProblemSolutionSection from '@/components/marketing/ProblemSolutionSection'
import ProductStackSection from '@/components/marketing/ProductStackSection'
import {isLocale} from '@/lib/i18n/config'
import {hrefFor, localeAlternates} from '@/lib/i18n/pathname'
import {getDictionary} from '@/lib/i18n/get-dictionary'

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        return {}
    }
    const dict = await getDictionary(rawLang)
    return {
        // Issue #347: the layout sets a '%s · Directwerk' template and homeTitle already
        // carries the brand, so a plain string title rendered 'Directwerk — … · Directwerk'.
        title: {absolute: dict.meta.homeTitle},
        description: dict.meta.homeDescription,
        alternates: {
            canonical: hrefFor(rawLang, '/'),
            languages: localeAlternates('/'),
        },
    }
}

export default async function Home({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<React.JSX.Element> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        notFound()
    }
    const dict = await getDictionary(rawLang)

    return (
        <>
            <HeroSection copy={dict.hero} />
            <ProblemSolutionSection copy={dict.problemSolution} />
            <LiveExampleSection copy={dict.liveExample} />
            <FeedsSection copy={dict.feeds} feedBuilder={dict.feedBuilder} />
            <ProductStackSection copy={dict.products} />
            <DeveloperTeaserSection copy={dict.developerTeaser} lang={rawLang} />
            <FaqSection copy={dict.faq} />
            <ContactFormSection />
        </>
    )
}
