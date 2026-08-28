import type {Metadata} from 'next'

import CtaSection from '@/components/marketing/CtaSection'
import CreatorJourneySection from '@/components/marketing/CreatorJourneySection'
import DeveloperTeaserSection from '@/components/marketing/DeveloperTeaserSection'
import FeaturesGridSection from '@/components/marketing/FeaturesGridSection'
import HeroSection from '@/components/marketing/HeroSection'
import ProblemSolutionSection from '@/components/marketing/ProblemSolutionSection'
import ProductStackSection from '@/components/marketing/ProductStackSection'

export const metadata: Metadata = {
    title: 'Directwerk — Whitelabel Publishing-Infrastruktur',
    description:
        'API-first Plattform für Podcast, Abonnements und digitales Publishing. Studio, Web, Admin und REST-API für Creators und Integratoren.',
}

export default function Home(): React.JSX.Element {
    return (
        <>
            <HeroSection />
            <ProblemSolutionSection />
            <ProductStackSection />
            <FeaturesGridSection />
            <CreatorJourneySection />
            <DeveloperTeaserSection />
            <CtaSection />
        </>
    )
}
