'use client'

import {Button} from '@directwerk/ui/components/button'

import Link from '@tiptap/extension-link'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {useEffect} from 'react'


const SAFE_LINK_PROTOCOLS = new Set(['https:', 'http:', 'mailto:', 'tel:'])

function isSafeLinkHref(value: string): boolean {
    try {
        return SAFE_LINK_PROTOCOLS.has(new URL(value).protocol)
    } catch {
        return false
    }
}

/**
 * Provides a rich-text editor for show notes or post content.
 *
 * @param value - The editor's HTML content.
 * @param onChange - Called with the updated HTML content.
 * @param label - The label displayed above the editor.
 * @param placeholder - The placeholder displayed when the editor is empty.
 * @param disabled - Disables editing and toolbar controls when `true`.
 */
export default function ShowNotesEditor({
    value,
    onChange,
    label = 'Text',
    placeholder = 'Shownotes oder Beitragstext…',
    disabled = false,
}: {
    value: string
    onChange: (html: string) => void
    label?: string
    placeholder?: string
    disabled?: boolean
}) {
    const editor = useEditor({
        // Required for Next.js App Router — avoids SSR/client hydration mismatch.
        immediatelyRender: false,
        editable: !disabled,
        extensions: [
            StarterKit.configure({
                heading: {levels: [2, 3]},
                blockquote: false,
                codeBlock: false,
                horizontalRule: false,
                // StarterKit v3 ships Link; use the dedicated extension instead.
                link: false,
            }),
            Link.configure({openOnClick: false, autolink: true}),
        ],
        content: value,
        onUpdate: ({editor: currentEditor}) => {
            onChange(currentEditor.getHTML())
        },
        editorProps: {
            attributes: {
                class: 'editor-surface content-prose',
                'data-placeholder': placeholder,
            },
            transformPastedHTML(html) {
                return html
                    .replace(/\s(?:style|class|id)="[^"]*"/gi, '')
                    .replace(/\son[a-z0-9-]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
                    .replace(/href\s*=\s*("|')\s*(?:javascript|data):[^"']*\1/gi, '')
                    .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, '')
            },
        },
    })

    useEffect(() => {
        if (!editor) {
            return
        }
        if (editor.getHTML() !== value) {
            editor.commands.setContent(value, {emitUpdate: false})
        }
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

    return (
        <div className="grid gap-2">
            <label className="text-sm font-medium">{label}</label>
            <div
                aria-hidden={disabled}
                className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1.5"
            >
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('bold') ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    B
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('italic') ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    I
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('heading', {level: 2}) ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
                >
                    H2
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('heading', {level: 3}) ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
                >
                    H3
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('bulletList') ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                >
                    •
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('orderedList') ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    1.
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={editor.isActive('link') ? 'secondary' : 'outline'}
                    disabled={disabled}
                    onClick={() => {
                        const previous = editor.getAttributes('link').href
                        const href = window.prompt('Link-URL', previous ?? 'https://')
                        if (href === null) {
                            return
                        }
                        const trimmed = href.trim()
                        if (trimmed.length === 0) {
                            editor.chain().focus().unsetLink().run()
                            return
                        }
                        if (!isSafeLinkHref(trimmed)) {
                            window.alert('Bitte eine gültige URL (https://, http://, mailto: oder tel:) eingeben.')
                            return
                        }
                        editor.chain().focus().setLink({href: trimmed}).run()
                    }}
                >
                    Link
                </Button>
            </div>
            <EditorContent editor={editor} />
        </div>
    )
}
