'use client'

import {Button} from '@directwerk/ui/components/button'

import Link from '@tiptap/extension-link'
import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {useEffect} from 'react'


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
        editor.setEditable(!disabled)
    }, [disabled, editor])

    if (!editor) {
        return null
    }

    return (
        <div className="grid gap-4">
            <div className="flex flex-wrap gap-1" aria-hidden={disabled}>
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
                        editor.chain().focus().setLink({href: trimmed}).run()
                    }}
                >
                    Link
                </Button>
            </div>
            <label className="text-xs text-muted-foreground">{label}</label>
            <EditorContent editor={editor} />
        </div>
    )
}
