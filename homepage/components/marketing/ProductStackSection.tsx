import StatCard from '@directwerk/ui/components/stat-card'

import SectionLabel from '@/components/marketing/SectionLabel'
import type {Dictionary} from '@/lib/i18n/get-dictionary'

export default function ProductStackSection({
    copy,
}: {
    copy: Dictionary['products']
}): React.JSX.Element {
    return (
        <section className="marketing-section" id="products">
            <div className="marketing-container">
                <SectionLabel>{copy.sectionLabel}</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    {copy.title}
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">{copy.body}</p>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                    {copy.items.map((product) => (
                        <StatCard
                            hint={product.copy}
                            key={product.name}
                            label={product.role}
                            value={product.name}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
