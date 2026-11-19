import { escapeHtml } from '../utils/dom.js';

function collectKatexStylesheets() {
  if (typeof document === 'undefined') return '';
  const parts = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href.toLowerCase().includes('katex')) {
      parts.push(`<link rel="stylesheet" href="${escapeHtml(link.href || href)}">`);
    }
  });
  return parts.join('\n');
}

/**
 * Build a self-contained, light-paper print/PDF HTML document for Notebook content.
 */
export function buildPrintableHtml({
  subjectName = 'Fleckshi',
  scopeLabel = 'Study Notes',
  toolLabel = 'Notes',
  bodyHtml = '',
  generatedDate = new Date().toLocaleDateString()
}) {
  const katexLinks = collectKatexStylesheets();
  const safeSubject = escapeHtml(subjectName);
  const safeScope = escapeHtml(scopeLabel);
  const safeTool = escapeHtml(toolLabel);
  const safeDate = escapeHtml(generatedDate);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeSubject} — ${safeScope} (${safeTool})</title>
${katexLinks}
<style>
  @page {
    size: A4;
    margin: 18mm 16mm 20mm;
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 9.5pt;
      color: #64748b;
    }
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
    font-size: 11pt;
    line-height: 1.62;
  }
  .pdf-page {
    max-width: 740px;
    margin: 0 auto;
    padding: 20px 24px 32px;
  }
  .pdf-doc-header {
    border-bottom: 2px solid #0f172a;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .pdf-kicker {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #2563eb;
    margin-bottom: 4px;
  }
  .pdf-title {
    margin: 0 0 6px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 20pt;
    line-height: 1.2;
    color: #0f172a;
  }
  .pdf-meta {
    font-size: 9.5pt;
    color: #475569;
  }
  .pdf-content h1, .pdf-content h2, .pdf-content h3, .pdf-content h4 {
    color: #0f172a;
    margin: 1.2em 0 0.45em;
    page-break-after: avoid;
    break-after: avoid;
  }
  .pdf-content h2 { font-size: 14pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  .pdf-content h3 { font-size: 12pt; }
  .pdf-content p { margin: 0 0 0.75em; }
  .pdf-content ul, .pdf-content ol { margin: 0 0 0.85em; padding-left: 1.4em; }
  .pdf-content li { margin-bottom: 0.3em; }
  .pdf-content pre, .pdf-content code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    background: #f1f5f9;
    color: #0f172a;
  }
  .pdf-content code { padding: 1px 5px; border-radius: 4px; font-size: 9.5pt; }
  .pdf-content pre {
    padding: 10px 12px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    overflow-x: auto;
    white-space: pre-wrap;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-content blockquote {
    margin: 0.8em 0;
    padding: 8px 12px;
    border-left: 3px solid #2563eb;
    background: #f8fafc;
    color: #334155;
  }
  .pdf-content table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.9em 0;
    font-size: 10pt;
  }
  .pdf-content th, .pdf-content td {
    border: 1px solid #cbd5e1;
    padding: 6px 8px;
    text-align: left;
  }
  .pdf-content th { background: #f1f5f9; font-weight: 700; }
  .nb-cite-chip {
    display: inline-block;
    font-size: 8.5pt;
    padding: 0 5px;
    border-radius: 4px;
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }
  .katex .katex-mathml {
    position: absolute;
    clip: rect(1px, 1px, 1px, 1px);
    padding: 0;
    border: 0;
    height: 1px;
    width: 1px;
    overflow: hidden;
  }
  @media print {
    .pdf-page { padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <article class="pdf-page">
    <header class="pdf-doc-header">
      <div class="pdf-kicker">${safeSubject} &middot; ${safeTool}</div>
      <h1 class="pdf-title">${safeScope}</h1>
      <div class="pdf-meta">Exported from Fleckshi &middot; ${safeDate}</div>
    </header>
    <main class="pdf-content">${bodyHtml}</main>
  </article>
</body>
</html>`;
}

/**
 * Print an HTML document cleanly via a hidden iframe without navigating away.
 */
export function printHtmlDocument(htmlDoc) {
  if (typeof document === 'undefined' || !htmlDoc) return false;
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  if (!win) {
    frame.remove();
    return false;
  }
  win.document.open();
  win.document.write(htmlDoc);
  win.document.close();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(() => frame.remove(), 1200);
    }
  };

  setTimeout(triggerPrint, 250);
  return true;
}
