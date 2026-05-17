<script lang="ts">
  import { marked } from 'marked'

  let { content } = $props<{ content: string }>()
</script>

<div class="markdown-preview">{@html content ? marked.parse(content) as string : ''}</div>

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
