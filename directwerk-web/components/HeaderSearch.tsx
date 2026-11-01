'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import {Input} from '@directwerk/ui/components/input'
import {cn} from '@directwerk/ui/lib/utils'

import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {
    clearSearchDocumentCache,
    loadSearchDocuments,
    rankSearchHits,
    searchHitLocked,
    searchUserKey,
    staticSearchPages,
    type SearchCorpusItem,
    type SearchDocument,
} from '@/lib/search/headerSearch'

const SEARCH_LIST_ID = 'header-search-results'

let open = false
let returnFocus: HTMLElement | null = null
const listeners = new Set<() => void>()

function subscribeSearchOpen(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

function getSearchOpen(): boolean {
    return open
}

export function resetHeaderSearchState(): void {
    open = false
    returnFocus = null
}

function setSearchOpen(next: boolean): void {
    open = next
    if (!next && returnFocus !== null) {
        const focus = returnFocus
        returnFocus = null
        queueMicrotask(() => {
            focus.focus()
        })
    }
    listeners.forEach((listener) => {
        listener()
    })
}

function rememberTrigger(node: EventTarget | null): void {
    if (node instanceof HTMLElement) {
        returnFocus = node
    }
}

function SearchGlyph(): React.JSX.Element {
    return (
        <svg
            aria-hidden
            fill="none"
            height="1em"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="1em"
        >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    )
}

export function HeaderSearchButton(): React.JSX.Element {
    const dictionary = useDictionary()
    const expanded = useSyncExternalStore(subscribeSearchOpen, getSearchOpen, () => false)
    return (
        <Button
            type="button"
            variant="ghost"
            className="size-11"
            aria-label={dictionary.search.open}
            aria-expanded={expanded}
            aria-controls={SEARCH_LIST_ID}
            onClick={(event) => {
                rememberTrigger(event.currentTarget)
                setSearchOpen(true)
            }}
        >
            <SearchGlyph />
        </Button>
    )
}

export function HeaderSearchDialog(): React.JSX.Element {
    const dictionary = useDictionary()
    const lang = useLocale()
    const router = useRouter()
    const {accessToken} = useSubscriberAuth()
    const dialogOpen = useSyncExternalStore(subscribeSearchOpen, getSearchOpen, () => false)
    const [query, setQuery] = useState('')
    const [documents, setDocuments] = useState<SearchDocument[]>([])
    const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
    const [active, setActive] = useState(0)
    const authed = accessToken !== null
    const authSeen = useRef<boolean | null>(null)

    const pages = useMemo(() => staticSearchPages(dictionary), [dictionary])
    const corpus = useMemo(() => [...pages, ...documents], [pages, documents])
    const hits = useMemo(() => rankSearchHits(corpus, query), [corpus, query])
    const trimmed = query.trim()
    const safeActive = hits.length === 0 ? 0 : active % hits.length

    useEffect(() => {
        if (authSeen.current === null) {
            authSeen.current = authed
            return
        }
        if (authSeen.current !== authed) {
            authSeen.current = authed
            clearSearchDocumentCache()
            setDocuments([])
            setStatus('idle')
        }
    }, [authed])

    useEffect(() => {
        function onKey(event: KeyboardEvent): void {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
                return
            }
            const target = event.target
            if (target instanceof HTMLElement) {
                const tag = target.tagName
                if (
                    tag === 'INPUT' ||
                    tag === 'TEXTAREA' ||
                    tag === 'SELECT' ||
                    target.isContentEditable
                ) {
                    return
                }
            }
            event.preventDefault()
            rememberTrigger(target)
            setSearchOpen(true)
        }
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
        }
    }, [])

    useEffect(() => {
        if (!dialogOpen) {
            setQuery('')
            setActive(0)
            return
        }
        let cancelled = false
        setStatus('loading')
        loadSearchDocuments(authed, searchUserKey(accessToken))
            .then((rows) => {
                if (!cancelled) {
                    setDocuments(rows)
                    setStatus('ready')
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setStatus('error')
                }
            })
        return () => {
            cancelled = true
        }
    }, [dialogOpen, authed, accessToken])

    function go(hit: SearchCorpusItem): void {
        setSearchOpen(false)
        router.push(localizedPath(lang, hit.hrefPath))
    }

    function onQueryKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (hits.length > 0) {
                setActive((index) => (index + 1) % hits.length)
            }
            return
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (hits.length > 0) {
                setActive((index) => (index - 1 + hits.length) % hits.length)
            }
            return
        }
        if (event.key === 'Enter') {
            const hit = hits[safeActive]
            if (hit !== undefined) {
                event.preventDefault()
                go(hit)
            }
        }
    }

    let statusText: string | null = null
    if (trimmed.length === 0) {
        statusText = dictionary.search.hint
    } else if (status === 'loading' && documents.length === 0 && hits.length === 0) {
        statusText = dictionary.search.loading
    } else if (status === 'error' && hits.length === 0) {
        statusText = dictionary.search.error
    } else if (status !== 'loading' && hits.length === 0) {
        statusText = dictionary.search.empty
    }

    return (
        <Dialog
            open={dialogOpen}
            onOpenChange={(next) => {
                setSearchOpen(next)
            }}
        >
            <DialogContent className="sm:max-w-lg" closeLabel={dictionary.search.close}>
                <DialogHeader>
                    <DialogTitle>{dictionary.search.open}</DialogTitle>
                    <DialogDescription className={trimmed.length === 0 ? undefined : 'sr-only'}>
                        {dictionary.search.hint}
                    </DialogDescription>
                </DialogHeader>
                <Input
                    autoFocus
                    value={query}
                    placeholder={dictionary.search.placeholder}
                    aria-controls={SEARCH_LIST_ID}
                    aria-activedescendant={
                        hits.length > 0 ? `${SEARCH_LIST_ID}-option-${safeActive}` : undefined
                    }
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setActive(0)
                    }}
                    onKeyDown={onQueryKeyDown}
                />
                {statusText !== null && statusText !== dictionary.search.hint ? (
                    <p role="status" aria-live="polite">
                        {statusText}
                    </p>
                ) : null}
                {trimmed.length > 0 && hits.length > 0 ? (
                    <ul
                        id={SEARCH_LIST_ID}
                        role="listbox"
                        aria-label={dictionary.search.open}
                        className="max-h-80 overflow-y-auto"
                    >
                        {hits.map((hit, index) => {
                            const locked = searchHitLocked(hit)
                            const selected = index === safeActive
                            return (
                                <li key={`${hit.kind}:${hit.slug}`} role="presentation">
                                    <Link
                                        id={`${SEARCH_LIST_ID}-option-${index}`}
                                        role="option"
                                        aria-selected={selected}
                                        href={localizedPath(lang, hit.hrefPath)}
                                        className={cn(
                                            'flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2',
                                            selected && 'bg-muted',
                                        )}
                                        onClick={() => {
                                            setSearchOpen(false)
                                        }}
                                    >
                                        <span className="truncate">{hit.title}</span>
                                        {locked ? (
                                            <span className="shrink-0 text-muted-foreground">
                                                {dictionary.search.locked}
                                            </span>
                                        ) : null}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <div id={SEARCH_LIST_ID} hidden />
                )}
            </DialogContent>
        </Dialog>
    )
}
