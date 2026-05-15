<script lang="ts">
  let { content } = $props<{ content: string }>()

  function renderMarkdown(md: string): string {
    if (!md) return ''
    // Escape HTML first to prevent XSS, then apply markdown transforms
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headings
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // List items
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive list items in <ul>
      .replace(/(<li>[\s\S]*?<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`)
      // Paragraphs: blank line = paragraph break
      .replace(/\n\n/g, '</p><p>')

    return `<p>${html}</p>`
      // Clean up empty paragraphs around block elements
      .replace(/<p>(<[hul])/g, '$1')
      .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1')
      .replace(/<p><\/p>/g, '')
  }
</script>

<div class="markdown-preview">{@html renderMarkdown(content)}</div>

<style>
  .markdown-preview {
    line-height: 1.7;
    color: var(--text);
  }

  .markdown-preview :global(h1),
  .markdown-preview :global(h2),
  .markdown-preview :global(h3) {
    margin: 16px 0 8px;
    color: var(--text);
  }

  .markdown-preview :global(h1) { font-size: 20px; }
  .markdown-preview :global(h2) { font-size: 17px; }
  .markdown-preview :global(h3) { font-size: 15px; }

  .markdown-preview :global(p) {
    margin-bottom: 10px;
  }

  .markdown-preview :global(ul) {
    padding-left: 20px;
    margin-bottom: 10px;
  }

  .markdown-preview :global(li) {
    margin-bottom: 4px;
  }

  .markdown-preview :global(strong) {
    font-weight: 600;
    color: var(--text);
  }

  .markdown-preview :global(em) {
    font-style: italic;
  }

  .markdown-preview :global(code) {
    background: var(--bg-elevated);
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
  }
</style>
