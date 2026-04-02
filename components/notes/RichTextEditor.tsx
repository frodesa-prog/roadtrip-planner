'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { useEffect } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, RemoveFormatting, ChevronDown,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert legacy plain-text notes to TipTap HTML on first load */
export function normalizeToHtml(content: string): string {
  if (!content) return ''
  if (content.trimStart().startsWith('<')) return content
  return content
    .split(/\n\n+/)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// ── Colour palette ────────────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: 'Standard',    color: null,      bg: '#64748b', border: true },
  { label: 'Amber',       color: '#f59e0b', bg: '#f59e0b', border: false },
  { label: 'Blå',         color: '#38bdf8', bg: '#38bdf8', border: false },
  { label: 'Grønn',       color: '#34d399', bg: '#34d399', border: false },
  { label: 'Rød',         color: '#f87171', bg: '#f87171', border: false },
  { label: 'Lilla',       color: '#a78bfa', bg: '#a78bfa', border: false },
  { label: 'Grå',         color: '#94a3b8', bg: '#94a3b8', border: false },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Divider() {
  return <div className="w-px h-4 bg-slate-700 mx-0.5 flex-shrink-0" />
}

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors flex-shrink-0 ${
        active
          ? 'bg-amber-700/60 text-amber-300'
          : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function HeadingDropdown({ editor }: { editor: Editor }) {
  const level = editor.isActive('heading', { level: 1 }) ? 1
    : editor.isActive('heading', { level: 2 }) ? 2
    : editor.isActive('heading', { level: 3 }) ? 3
    : 0

  const label = level ? `H${level}` : 'Tekst'

  const options = [
    { id: 0, name: 'Brødtekst',   action: () => editor.chain().focus().setParagraph().run() },
    { id: 1, name: 'Overskrift 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: 2, name: 'Overskrift 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: 3, name: 'Overskrift 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
  ]

  return (
    <div className="relative group flex-shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors w-[4.5rem] justify-between"
      >
        <span className="font-medium">{label}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      <div className="absolute left-0 top-full mt-0.5 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-20 hidden group-hover:block w-36">
        {options.map(({ id, name, action }) => (
          <button
            key={id}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); action() }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg transition-colors ${
              level === id ? 'text-amber-300' : 'text-slate-300'
            }`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-800 flex-wrap flex-shrink-0 bg-slate-900/80">

      <HeadingDropdown editor={editor} />

      <Divider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')} title="Fet (⌘B)">
        <Bold className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')} title="Kursiv (⌘I)">
        <Italic className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')} title="Understreking (⌘U)">
        <UnderlineIcon className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')} title="Gjennomstreking">
        <Strikethrough className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <Divider />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')} title="Punktliste">
        <List className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')} title="Nummerert liste">
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')} title="Sitat">
        <Quote className="w-3.5 h-3.5" />
      </ToolbarBtn>

      <Divider />

      {/* Colour swatches */}
      {TEXT_COLORS.map(({ label, color, bg, border }) => (
        <button
          key={label}
          type="button"
          title={label}
          onMouseDown={(e) => {
            e.preventDefault()
            color
              ? editor.chain().focus().setColor(color).run()
              : editor.chain().focus().unsetColor().run()
          }}
          className="w-[18px] h-[18px] rounded-full hover:scale-125 transition-transform flex-shrink-0"
          style={{
            backgroundColor: bg,
            border: border ? '1.5px dashed #475569' : '1.5px solid #1e293b',
            opacity: border ? 0.7 : 1,
          }}
        />
      ))}

      <Divider />

      <ToolbarBtn
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        active={false} title="Fjern formatering">
        <RemoveFormatting className="w-3.5 h-3.5" />
      </ToolbarBtn>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  /** Called when user pastes an image file (to trigger upload) */
  onPasteImage?: (file: File) => void
}

export default function RichTextEditor({
  content, onChange, placeholder, className = '', autoFocus, onPasteImage,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
    ],
    content: normalizeToHtml(content),
    onUpdate({ editor }) {
      const html = editor.getHTML()
      onChange(html === '<p></p>' ? '' : html)
    },
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'rte-content outline-none',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
      handlePaste(_, event) {
        if (!onPasteImage) return false
        const items = Array.from(event.clipboardData?.items ?? [])
        const imgItem = items.find(i => i.type.startsWith('image/'))
        if (!imgItem) return false
        const file = imgItem.getAsFile()
        if (file) {
          onPasteImage(new File([file], `paste-${Date.now()}.png`, { type: file.type }))
          return true
        }
        return false
      },
    },
    immediatelyRender: false,
  })

  // Sync when switching to a different note
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const normalized = normalizeToHtml(content)
    if (editor.getHTML() !== normalized && !editor.isFocused) {
      editor.commands.setContent(normalized, { emitUpdate: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {editor && <Toolbar editor={editor} />}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

// ── Read-only rich text renderer ──────────────────────────────────────────────

export function RichTextRenderer({ html, className = '' }: { html: string; className?: string }) {
  const normalized = normalizeToHtml(html)
  return (
    <div
      className={`rte-content ${className}`}
      dangerouslySetInnerHTML={{ __html: normalized }}
    />
  )
}
