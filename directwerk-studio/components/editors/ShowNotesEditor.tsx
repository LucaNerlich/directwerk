'use client'

import {Button} from '@directwerk/ui/components/button'

import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import {TableKit} from '@tiptap/extension-table'
import {EditorContent, useEditor, useEditorState, type Editor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
    Bold,
    Heading2,
    Heading3,
    ImageIcon,
    Italic,
    Link2,
    List,
    ListOrdered,
    Minus,
    Quote,
    Redo2,
    RemoveFormatting,
    Strikethrough,
    Undo2,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import {useCallback, useEffect, useId, useRef, useState, type ReactNode} from 'react'

import type {MediaAsset} from '@directwerk/api/types'
import {sanitizeContentHtml} from '@directwerk/api/content/sanitizeContentHtml'
import {safeImageSrc, safeLinkHref} from '@/lib/url/safeUrl'
import {useDictionary} from '@/components/i18n/LocaleProvider'

/** Push HTML to the parent after typing settles; blur/unmount flush immediately. */
const BODY_PUSH_DEBOUNCE_MS = 200

/** Load media-insert UI only on first Medium click — keep it out of the TipTap chunk. */
const MediaInlinePickerDialog = dynamic(
    () => import('@/components/media/MediaInlinePickerDialog'),
    {ssr: false},
)


function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function sanitizePastedHtml(html: string): string {
    const parsed = new DOMParser().parseFromString(
        sanitizeContentHtml(html),
        'text/html',
    )

    parsed.body.querySelectorAll('img').forEach((image) => {
        const src = safeImageSrc(image.getAttribute('src'))
        if (src === null) {
            image.remove()
            return
        }
        image.setAttribute('src', src)
    })

    parsed.body.querySelectorAll('a').forEach((anchor) => {
        const href = safeLinkHref(anchor.getAttribute('href'))
        if (href === null) {
            anchor.removeAttribute('href')
            return
        }
        anchor.setAttribute('href', href)
    })

    return parsed.body.innerHTML
}

function ToolbarDivider() {
    return <span aria-hidden="true" className="mx-0.5 h-6 w-px self-center bg-border" />
}

function ToolbarButton({
    active,
    disabled,
    label,
    onClick,
    title,
    children,
}: {
    active?: boolean
    disabled: boolean
    label: string
    onClick: () => void
    title: string
    children: ReactNode
}) {
    return (
        <Button
            type="button"
            size="sm"
            variant={active ? 'secondary' : 'outline'}
            disabled={disabled}
            aria-label={label}
            aria-pressed={active}
            title={title}
            onClick={onClick}
            className="size-8 px-0"
        >
            {children}
        </Button>
    )
}

function EditorToolbar({
    editor,
    disabled,
    formatLabel,
    allowMediaInsert,
    onOpenMedia,
}: {
    editor: Editor
    disabled: boolean
    formatLabel: string
    allowMediaInsert: boolean
    onOpenMedia: () => void
}) {
    const dict = useDictionary()
    const toolbarLabelId = useId()
    const mediaDisabled = disabled || !allowMediaInsert
    const toolbarState = useEditorState({
        editor,
        selector: ({editor: current}) => ({
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            strike: current.isActive('strike'),
            h2: current.isActive('heading', {level: 2}),
            h3: current.isActive('heading', {level: 3}),
            bulletList: current.isActive('bulletList'),
            orderedList: current.isActive('orderedList'),
            blockquote: current.isActive('blockquote'),
            link: current.isActive('link'),
        }),
    })

    return (
        <div
            aria-labelledby={toolbarLabelId}
            className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1.5"
            role="toolbar"
        >
            <span className="sr-only" id={toolbarLabelId}>
                {formatLabel} formatieren
            </span>
            <ToolbarButton
                disabled={disabled || !toolbarState.canUndo}
                label={dict.publication.rueckgaengig}
                title={dict.publication.rueckgaengigStrgZ}
                onClick={() => editor.chain().focus().undo().run()}
            >
                <Undo2 aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                disabled={disabled || !toolbarState.canRedo}
                label="Wiederholen"
                title="Wiederholen (Strg+Shift+Z)"
                onClick={() => editor.chain().focus().redo().run()}
            >
                <Redo2 aria-hidden="true" className="size-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
                active={toolbarState.bold}
                disabled={disabled}
                label="Fett"
                title="Fett (Strg+B)"
                onClick={() => editor.chain().focus().toggleBold().run()}
            >
                <Bold aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                active={toolbarState.italic}
                disabled={disabled}
                label="Kursiv"
                title="Kursiv (Strg+I)"
                onClick={() => editor.chain().focus().toggleItalic().run()}
            >
                <Italic aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                active={toolbarState.strike}
                disabled={disabled}
                label="Durchgestrichen"
                title="Durchgestrichen"
                onClick={() => editor.chain().focus().toggleStrike().run()}
            >
                <Strikethrough aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                disabled={disabled}
                label="Formatierung entfernen"
                title="Formatierung entfernen"
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            >
                <RemoveFormatting aria-hidden="true" className="size-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
                active={toolbarState.h2}
                disabled={disabled}
                label="Überschrift Ebene 2"
                title="Überschrift Ebene 2"
                onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
            >
                <Heading2 aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                active={toolbarState.h3}
                disabled={disabled}
                label="Überschrift Ebene 3"
                title="Überschrift Ebene 3"
                onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
            >
                <Heading3 aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                active={toolbarState.bulletList}
                disabled={disabled}
                label={dict.publication.aufzaehlungsliste}
                title={dict.publication.aufzaehlungsliste}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
                <List aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                active={toolbarState.orderedList}
                disabled={disabled}
                label={dict.common.numberedList}
                title={dict.common.numberedList}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
                <ListOrdered aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                active={toolbarState.blockquote}
                disabled={disabled}
                label="Zitat"
                title="Zitat"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
                <Quote aria-hidden="true" className="size-4" />
            </ToolbarButton>
            <ToolbarButton
                disabled={disabled}
                label={dict.publication.trennlinieEinfuegen}
                title={dict.publication.trennlinieEinfuegen}
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
            >
                <Minus aria-hidden="true" className="size-4" />
            </ToolbarButton>

            <ToolbarDivider />

            <ToolbarButton
                active={toolbarState.link}
                disabled={disabled}
                label={dict.publication.linkEinfuegenEntfernen}
                title={dict.publication.linkEinfuegenEntfernen}
                onClick={() => {
                    const previous = editor.getAttributes('link').href
                    const href = window.prompt(dict.common.linkUrl, previous ?? 'https://')
                    if (href === null) {
                        return
                    }
                    const trimmed = href.trim()
                    if (trimmed.length === 0) {
                        editor.chain().focus().unsetLink().run()
                        return
                    }
                    if (safeLinkHref(trimmed) === null) {
                        window.alert(
                            'Bitte eine gültige URL (https://, http://, mailto: oder tel:) eingeben.',
                        )
                        return
                    }
                    editor.chain().focus().extendMarkRange('link').setLink({href: trimmed}).run()
                }}
            >
                <Link2 aria-hidden="true" className="size-4" />
            </ToolbarButton>
            {allowMediaInsert ? (
                <ToolbarButton
                    disabled={mediaDisabled}
                    label={dict.media.mediumMediathekEinfuegen}
                    title={dict.publication.bildEinbettenAudioVideoDokumentVerlinken}
                    onClick={onOpenMedia}
                >
                    <ImageIcon aria-hidden="true" className="size-4" />
                </ToolbarButton>
            ) : null}
        </div>
    )
}

/**
 * Provides a rich-text editor for show notes or post content.
 *
 * Inline media from the media library (PUBLIC READY assets) can be inserted at
 * the cursor: images are embedded as `<img>`, audio/video/documents as links.
 * Private assets are excluded by the picker — their preview URLs expire and
 * must never end up in public HTML.
 */
export default function ShowNotesEditor({
    value,
    onChange,
    label = 'Text',
    placeholder = 'Shownotes oder Beitragstext…',
    disabled = false,
    helperText,
    allowMediaInsert = true,
    onAuthRequired,
}: {
    value: string
    onChange: (html: string) => void
    label?: string
    placeholder?: string
    disabled?: boolean
    helperText?: string
    allowMediaInsert?: boolean
    onAuthRequired?: () => void
}) {
    const labelId = useId()
    const helperId = useId()
    const [mediaDialogOpen, setMediaDialogOpen] = useState(false)
    const [mediaDialogLoaded, setMediaDialogLoaded] = useState(false)
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    /** Last HTML we pushed (or accepted from props) — skips setContent feedback thrash. */
    const syncedHtmlRef = useRef(value)
    const pendingHtmlRef = useRef<string | null>(null)
    const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const flushBody = useCallback((): void => {
        if (pushTimerRef.current !== null) {
            clearTimeout(pushTimerRef.current)
            pushTimerRef.current = null
        }
        const pending = pendingHtmlRef.current
        if (pending === null) {
            return
        }
        pendingHtmlRef.current = null
        syncedHtmlRef.current = pending
        onChangeRef.current(pending)
    }, [])

    const scheduleBodyPush = useCallback(
        (html: string): void => {
            pendingHtmlRef.current = html
            if (pushTimerRef.current !== null) {
                clearTimeout(pushTimerRef.current)
            }
            pushTimerRef.current = setTimeout(() => {
                pushTimerRef.current = null
                flushBody()
            }, BODY_PUSH_DEBOUNCE_MS)
        },
        [flushBody],
    )

    useEffect(() => () => flushBody(), [flushBody])

    const editor = useEditor({
        // Required for Next.js App Router — avoids SSR/client hydration mismatch.
        immediatelyRender: false,
        editable: !disabled,
        extensions: [
            StarterKit.configure({
                heading: {levels: [2, 3]},
                codeBlock: false,
                // StarterKit v3 ships Link; use the dedicated extension instead.
                link: false,
            }),
            Link.configure({openOnClick: false, autolink: true}),
            Image.configure({
                // Base64 would bloat the database and never survive the
                // backend sanitizer — only https CDN URLs from the library.
                allowBase64: false,
                HTMLAttributes: {loading: 'lazy'},
            }),
            // Schema-only: preserves GFM/MCP table HTML on round-trip; no toolbar.
            TableKit.configure({table: {resizable: false}}),
        ],
        content: value,
        onUpdate: ({editor: currentEditor}) => {
            scheduleBodyPush(currentEditor.getHTML())
        },
        onBlur: () => {
            flushBody()
        },
        editorProps: {
            attributes: {
                'aria-describedby': helperId,
                'aria-labelledby': labelId,
                class: 'editor-surface content-prose',
                'data-placeholder': placeholder,
            },
            transformPastedHTML(html) {
                return sanitizePastedHtml(html)
            },
        },
    })

    useEffect(() => {
        if (!editor) {
            return
        }
        // Skip echoes of our own pushes and unflushed local edits only.
        if (value === syncedHtmlRef.current || value === pendingHtmlRef.current) {
            return
        }
        // Divergent parent value (soft-nav / reload) — drop pending debounce and apply.
        if (pushTimerRef.current !== null) {
            clearTimeout(pushTimerRef.current)
            pushTimerRef.current = null
        }
        pendingHtmlRef.current = null
        if (editor.getHTML() !== value) {
            editor.commands.setContent(value, {emitUpdate: false})
        }
        syncedHtmlRef.current = value
    }, [editor, value])

    useEffect(() => {
        if (!editor) {
            return
        }
        editor.setEditable(!disabled, false)
    }, [disabled, editor])

    if (!editor) {
        return null
    }

    const handleInsertMedia = (asset: MediaAsset): void => {
        const fileLabel = asset.originalFilename ?? `Datei ${asset.id}`
        if (asset.assetType === 'IMAGE') {
            const src = safeImageSrc(asset.cdnUrl)
            if (src === null) {
                return
            }
            editor.chain().focus().setImage({src, alt: fileLabel, title: fileLabel}).run()
            return
        }
        const href = safeLinkHref(asset.cdnUrl)
        if (href === null) {
            return
        }
        editor
            .chain()
            .focus()
            .insertContent(
                `<a href="${href}">${escapeHtml(fileLabel)}</a>`,
            )
            .run()
    }

    const openMediaDialog = (): void => {
        setMediaDialogLoaded(true)
        setMediaDialogOpen(true)
    }

    return (
        <div className="grid gap-2">
            <p className="text-sm font-medium" id={labelId}>{label}</p>
            <EditorToolbar
                allowMediaInsert={allowMediaInsert}
                disabled={disabled}
                editor={editor}
                formatLabel={label}
                onOpenMedia={openMediaDialog}
            />
            <div aria-labelledby={labelId}>
                <EditorContent editor={editor} />
            </div>
            <p className="text-xs font-normal text-muted-foreground" id={helperId}>
                {helperText ?? 'Formatierung über die Werkzeugleiste. Links brauchen https://, http://, mailto: oder tel:.'}
            </p>
            {allowMediaInsert && mediaDialogLoaded ? (
                <MediaInlinePickerDialog
                    onAuthRequired={onAuthRequired ?? (() => {})}
                    onInsert={handleInsertMedia}
                    onOpenChange={setMediaDialogOpen}
                    open={mediaDialogOpen}
                />
            ) : null}
        </div>
    )
}
