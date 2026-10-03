import SectionLabel from '@/components/marketing/SectionLabel'
import FeedBuilderMock from '@/components/marketing/FeedBuilderMock'
import type {Dictionary} from '@/lib/i18n/get-dictionary'

export default function FeedsSection({
    copy,
    feedBuilder,
}: {
    copy: Dictionary['feeds']
    feedBuilder: Dictionary['feedBuilder']
}): React.JSX.Element {
    return (
        <section className="marketing-section" id="feeds">
            <div className="marketing-container">
                <SectionLabel>{copy.sectionLabel}</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    {copy.title}
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">{copy.body}</p>
                <div className="mt-10 grid items-start gap-4 lg:grid-cols-2">
                    <div className="grid gap-4">
                        {copy.types.map((feed) => (
                            <article className="glass-panel rounded-2xl p-6" key={feed.title}>
                                <h3 className="font-semibold">{feed.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {feed.copy}
                                </p>
                            </article>
                        ))}
                    </div>
                    <FeedBuilderMock copy={feedBuilder} />
                </div>
            </div>
        </section>
    )
}
