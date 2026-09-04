import type {Metadata} from 'next'

import ContactFormSection from '@/components/marketing/ContactFormSection'
import CreatorJourneySection from '@/components/marketing/CreatorJourneySection'
import DeveloperTeaserSection from '@/components/marketing/DeveloperTeaserSection'
import FaqSection from '@/components/marketing/FaqSection'
import FeaturesGridSection from '@/components/marketing/FeaturesGridSection'
import FeedsSection from '@/components/marketing/FeedsSection'
import HeroSection from '@/components/marketing/HeroSection'
import PrivacySection from '@/components/marketing/PrivacySection'
import ProblemSolutionSection from '@/components/marketing/ProblemSolutionSection'
import ProductStackSection from '@/components/marketing/ProductStackSection'

export const metadata: Metadata = {
    title: 'Directwerk — Europäische Podcast- & Publishing-Plattform',
    description:
        'DSGVO-konforme Whitelabel-Plattform für Podcast, Artikel und Newsletter mit EU-Hosting: Creator-Studio, private Feeds, Feed-Builder pro Hörer und REST-API.',
}

export default function Home(): React.JSX.Element {
    return (
        <>
            <HeroSection />
            <ProblemSolutionSection />
            <PrivacySection />
            <FeedsSection />
            <ProductStackSection />
            <FeaturesGridSection />
            <CreatorJourneySection />
            <DeveloperTeaserSection />
            <FaqSection />
            <ContactFormSection />
        </>
    )
}
