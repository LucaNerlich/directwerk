/**
 * Decorative text + audio motif for the home hero when no cover/hero image is
 * available. Pure SVG — no stickers, no emoji overlays.
 */
export default function HomeHeroMotif({
    showAudio,
    showText,
}: {
    showAudio: boolean
    showText: boolean
}): React.JSX.Element {
    return (
        <div
            aria-hidden="true"
            className="dw-glass relative flex aspect-[4/5] w-full max-w-md flex-col justify-end overflow-hidden rounded-3xl p-6 sm:aspect-square sm:max-w-none"
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,color-mix(in_oklab,var(--primary)_35%,transparent),transparent_55%)]" />
            {showText ? (
                <svg
                    className="dw-type-lines absolute left-6 top-8 h-28 w-40 opacity-70"
                    fill="none"
                    viewBox="0 0 160 112"
                >
                    <rect fill="currentColor" height="10" rx="3" width="132" x="0" y="0" />
                    <rect fill="currentColor" height="10" opacity="0.7" rx="3" width="108" x="0" y="22" />
                    <rect fill="currentColor" height="10" opacity="0.55" rx="3" width="148" x="0" y="44" />
                    <rect fill="currentColor" height="10" opacity="0.4" rx="3" width="92" x="0" y="66" />
                    <rect fill="currentColor" height="10" opacity="0.28" rx="3" width="118" x="0" y="88" />
                </svg>
            ) : null}
            {showAudio ? (
                <svg
                    className="dw-waveform relative mt-auto h-24 w-full"
                    fill="none"
                    preserveAspectRatio="none"
                    viewBox="0 0 320 96"
                >
                    {[
                        18, 34, 52, 28, 64, 40, 72, 30, 58, 44, 76, 36, 62, 26, 48, 70, 32, 54, 42,
                        66, 24, 50, 38, 60, 46, 68, 22, 56, 34, 48,
                    ].map((height, index) => {
                        const x = 6 + index * 10
                        const y = (96 - height) / 2
                        return (
                            <rect
                                fill="currentColor"
                                height={height}
                                key={x}
                                opacity={0.35 + (index % 5) * 0.1}
                                rx="2.5"
                                width="5"
                                x={x}
                                y={y}
                            />
                        )
                    })}
                </svg>
            ) : null}
            {!showAudio && !showText ? (
                <div className="relative mt-auto h-24 w-full rounded-2xl bg-[color-mix(in_oklab,var(--primary)_18%,transparent)]" />
            ) : null}
        </div>
    )
}
