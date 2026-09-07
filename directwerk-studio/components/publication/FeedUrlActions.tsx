import {Button} from '@directwerk/ui/components/button'

import {safeLinkHref} from '@/lib/url/safeUrl'

/**
 * Renders controls for opening and copying a feed URL.
 *
 * @param copiedUrl - The URL most recently copied, if any
 * @param onCopy - Callback invoked with the URL to copy
 * @param url - The feed URL
 */
export default function FeedUrlActions({
    copiedUrl,
    onCopy,
    url,
}: {
    copiedUrl: string | null
    onCopy: (url: string) => void
    url: string
}): React.JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {safeLinkHref(url) !== null ? (
                <a
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={url}
                    rel="noreferrer"
                    target="_blank"
                >
                    Öffnen
                </a>
            ) : null}
            <Button
                aria-label={copiedUrl === url ? 'Feed-URL kopiert' : 'Feed-URL kopieren'}
                onClick={() => onCopy(url)}
                size="sm"
                type="button"
                variant="outline"
            >
                {copiedUrl === url ? 'Kopiert!' : 'Kopieren'}
            </Button>
            {copiedUrl === url ? (
                <span className="sr-only" role="status">
                    Feed-URL kopiert.
                </span>
            ) : null}
        </div>
    )
}
