import type {Metadata} from 'next'

import ContactFormSection from '@/components/marketing/ContactFormSection'
import DeveloperTeaserSection from '@/components/marketing/DeveloperTeaserSection'
import FaqSection from '@/components/marketing/FaqSection'
import FeedsSection from '@/components/marketing/FeedsSection'
import HeroSection from '@/components/marketing/HeroSection'
import LiveExampleSection from '@/components/marketing/LiveExampleSection'
import ProblemSolutionSection from '@/components/marketing/ProblemSolutionSection'
import ProductStackSection from '@/components/marketing/ProductStackSection'

export const metadata: Metadata = {
    title: 'Directwerk — Deine Podcast- & Content-Plattform',
    description:
        'Podcast- und Content-Plattform mit Studio, Website für Hörer, Abos und Hosting in Europa — klar aufgebaut, ohne Technikstress.',
}

export default function Home(): React.JSX.Element {
    return (
        <>
            <HeroSection />
            <ProblemSolutionSection />
            <LiveExampleSection />
            <FeedsSection />
            <ProductStackSection />
            <DeveloperTeaserSection />
            <FaqSection />
            <ContactFormSection />
        </>
    )
}
