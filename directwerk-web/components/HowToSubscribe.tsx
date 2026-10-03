'use client'

import {useDictionary} from '@/lib/i18n/LocaleProvider'

/**
 * Steps-only subscribe instructions for podcast and/or article feeds.
 * Feed URLs live in the management sections on `/feeds` — this card does not
 * re-embed them.
 */
interface HowToSubscribeProps {
    /** Show podcast-app setup steps. */
    podcast?: boolean
    /** Show feed-reader setup steps. */
    articles?: boolean
}

function PodcastBlock(): React.JSX.Element {
    const {feeds} = useDictionary()
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">{feeds.howToPodcastTitle}</h2>
                <p className="text-sm text-muted-foreground">{feeds.howToPodcastIntro}</p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>{feeds.howToPodcastStep1}</li>
                <li>{feeds.howToPodcastStep2}</li>
                <li>
                    {feeds.howToPodcastStep3Before}
                    <strong>{feeds.howToPodcastStep3Strong}</strong>
                    {feeds.howToPodcastStep3After}
                </li>
            </ol>
        </div>
    )
}

function ArticlesBlock(): React.JSX.Element {
    const {feeds} = useDictionary()
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">{feeds.howToArticlesTitle}</h2>
                <p className="text-sm text-muted-foreground">{feeds.howToArticlesIntro}</p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>{feeds.howToArticlesStep1}</li>
                <li>{feeds.howToArticlesStep2}</li>
                <li>
                    {feeds.howToArticlesStep3Before}
                    <strong>{feeds.howToArticlesStep3Strong}</strong>
                    {feeds.howToArticlesStep3After}
                </li>
            </ol>
        </div>
    )
}

/**
 * Unified subscribe instructions for podcast and article feeds. Renders the
 * podcast block, the articles block, or both in one card — without URLs. Returns
 * `null` when neither feed kind is enabled.
 */
export default function HowToSubscribe({
    podcast = false,
    articles = false,
}: HowToSubscribeProps): React.JSX.Element | null {
    if (!podcast && !articles) {
        return null
    }
    return (
        <section className="space-y-6 rounded-xl border bg-card p-5 shadow-sm">
            {podcast ? <PodcastBlock /> : null}
            {podcast && articles ? <div aria-hidden="true" className="border-t" /> : null}
            {articles ? <ArticlesBlock /> : null}
        </section>
    )
}
