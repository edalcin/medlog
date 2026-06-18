<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Editor } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Placeholder from '@tiptap/extension-placeholder'
  import { Markdown } from 'tiptap-markdown'

  let { value = $bindable(''), placeholder = 'Anotações da consulta...', disabled = false } = $props()

  let editorEl: HTMLDivElement
  let editor = $state<Editor | undefined>(undefined)

  onMount(() => {
    editor = new Editor({
      element: editorEl,
      extensions: [
        StarterKit,
        Markdown,
        Placeholder.configure({ placeholder }),
      ],
      content: value,
      editable: !disabled,
      onUpdate: ({ editor: e }) => {
        value = (e.storage.markdown as { getMarkdown: () => string }).getMarkdown()
      },
    })
  })

  onDestroy(() => {
    editor?.destroy()
  })

  $effect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!disabled)
    }
  })

  function cmd(action: () => boolean | void) {
    return (e: MouseEvent) => {
      e.preventDefault()
      action()
    }
  }
</script>

<div class="editor-wrapper" class:disabled>
  <div class="toolbar">
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('bold')}
      title="Negrito (Ctrl+B)"
      onclick={cmd(() => editor?.chain().focus().toggleBold().run())}
    >
      <i class="bx bx-bold"></i>
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('italic')}
      title="Itálico (Ctrl+I)"
      onclick={cmd(() => editor?.chain().focus().toggleItalic().run())}
    >
      <i class="bx bx-italic"></i>
    </button>
    <div class="separator"></div>
    <button
      type="button"
      class="tb-btn heading"
      class:active={editor?.isActive('heading', { level: 2 })}
      title="Título 2"
      onclick={cmd(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
    >
      <i class="bx bxs-heading"></i><span>2</span>
    </button>
    <button
      type="button"
      class="tb-btn heading"
      class:active={editor?.isActive('heading', { level: 3 })}
      title="Título 3"
      onclick={cmd(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
    >
      <i class="bx bxs-heading"></i><span>3</span>
    </button>
    <div class="separator"></div>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('bulletList')}
      title="Lista com marcadores"
      onclick={cmd(() => editor?.chain().focus().toggleBulletList().run())}
    >
      <i class="bx bx-list-ul"></i>
    </button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('orderedList')}
      title="Lista numerada"
      onclick={cmd(() => editor?.chain().focus().toggleOrderedList().run())}
    >
      <i class="bx bx-list-ol"></i>
    </button>
  </div>

  <div class="prosemirror-host" bind:this={editorEl}></div>
</div>

<style>
  .editor-wrapper {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .editor-wrapper.disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  .toolbar {
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    padding: 6px 8px;
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    align-items: center;
  }

  .separator {
    width: 1px;
    height: 18px;
    background: var(--border);
    margin: 0 2px;
  }

  .tb-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    min-width: 36px;
    min-height: 36px;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .tb-btn i {
    font-size: 16px;
    line-height: 1;
  }

  .tb-btn.heading i {
    font-size: 14px;
  }

  .tb-btn.heading span {
    font-size: 11px;
    font-weight: 700;
    margin-left: 1px;
  }

  .tb-btn:hover {
    background: var(--bg-elevated);
    color: var(--text);
  }

  .tb-btn.active {
    color: var(--accent);
    background: var(--bg-elevated);
  }

  .prosemirror-host {
    background: var(--bg);
  }

  :global(.ProseMirror) {
    min-height: 140px;
    padding: 10px 14px;
    outline: none;
    color: var(--text);
    background: var(--bg);
    line-height: 1.7;
    font-size: 14px;
  }

  :global(.ProseMirror p.is-editor-empty:first-child::before) {
    color: var(--text-muted);
    content: attr(data-placeholder);
    pointer-events: none;
    float: left;
    height: 0;
  }

  :global(.ProseMirror h2) {
    font-size: 1.25em;
    font-weight: 700;
    margin: 1em 0 0.4em;
    color: var(--text);
  }

  :global(.ProseMirror h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin: 0.9em 0 0.35em;
    color: var(--text);
  }

  :global(.ProseMirror ul),
  :global(.ProseMirror ol) {
    padding-left: 1.5em;
    margin: 0.4em 0;
  }

  :global(.ProseMirror li) {
    margin: 0.15em 0;
  }

  :global(.ProseMirror strong) {
    font-weight: 700;
    color: var(--text);
  }

  :global(.ProseMirror em) {
    font-style: italic;
  }

  :global(.ProseMirror p) {
    margin: 0.25em 0;
  }
</style>
