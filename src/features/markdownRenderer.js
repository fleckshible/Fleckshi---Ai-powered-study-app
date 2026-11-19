import { marked } from 'marked';
import katex from 'katex';
import DOMPurify from 'dompurify';
import { escapeHtml } from '../utils/dom.js';

const MATH_ALLOWED_TAGS = [
  'math',
  'semantics',
  'mrow',
  'mi',
  'mo',
  'mn',
  'msup',
  'msub',
  'msubsup',
  'mfrac',
  'msqrt',
  'mroot',
  'mtable',
  'mtr',
  'mtd',
  'mtext',
  'mspace',
  'mover',
  'munder',
  'munderover',
  'mpadded',
  'mstyle',
  'menclose',
  'annotation',
  'svg',
  'path',
  'line',
  'rect',
  'circle',
  'g',
  'button'
];

const MATH_ALLOWED_ATTR = [
  'data-cite-chunk',
  'aria-hidden',
  'style',
  'xmlns',
  'viewBox',
  'd',
  'preserveAspectRatio',
  'focusable',
  'width',
  'height',
  'encoding',
  'type',
  'title'
];

function fallbackSanitizeHtml(html) {
  return String(html || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|style|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data:text\/html)[\s\S]*?\2/gi, '$1=$2#$2');
}

function sanitizeRenderedHtml(html) {
  const preCleaned = String(html || '');
  if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
    return DOMPurify.sanitize(preCleaned, {
      ADD_TAGS: MATH_ALLOWED_TAGS,
      ADD_ATTR: MATH_ALLOWED_ATTR,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    });
  }
  return fallbackSanitizeHtml(preCleaned);
}

function renderLatexSafe(expr, displayMode) {
  const trimmed = String(expr || '').trim();
  if (!trimmed) return '';
  try {
    const rendered = katex.renderToString(trimmed, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      output: 'htmlAndMathml'
    });
    return displayMode
      ? `<div class="nb-math-block" tabindex="0" aria-label="Equation block">${rendered}</div>`
      : `<span class="nb-math-inline">${rendered}</span>`;
  } catch {
    return displayMode
      ? `<pre class="nb-math-block"><code class="nb-math-fallback">${escapeHtml(trimmed)}</code></pre>`
      : `<code class="nb-math-fallback">${escapeHtml(trimmed)}</code>`;
  }
}

function replaceCitationsInHtml(html, allChunks = []) {
  if (!allChunks || !allChunks.length) return html;
  const byId = new Map(allChunks.map((c) => [c.id, c]));
  const byLabel = new Map(allChunks.map((c) => [c.label, c]));

  // Replace [token] only outside existing HTML tag brackets
  return html.replace(/(>[^<]*)|(^[^<]+)/g, (segment) =>
    segment.replace(/\[([^\]]+)\]/g, (full, inner) => {
      const tokens = inner.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      const pills = tokens
        .map((tok) => {
          const chunk = byId.get(tok) || byLabel.get(tok);
          if (!chunk) return null;
          return `<button type="button" class="nb-cite-btn" data-cite-chunk="${escapeHtml(
            chunk.id
          )}" title="View cited chunk">${escapeHtml(chunk.label)}</button>`;
        })
        .filter(Boolean);
      return pills.length ? pills.join(' ') : full;
    })
  );
}

function enhanceKeyValueLists(html) {
  return html
    .replace(/<li>(\s*(?:<p>)?)\s*<strong>([^<]{1,90}:?)<\/strong>/gi, (_full, pOpen, label) => {
      const hasColon = label.endsWith(':');
      if (!hasColon && label.length > 45) return _full;
      return `<li class="nb-kv-item">${pOpen}<strong class="nb-kv-term">${label}</strong>`;
    })
    .replace(/<p>\s*(<div class="nb-math-block"[\s\S]*?<\/div>)\s*<\/p>/g, '$1');
}

/**
 * Parse Markdown + LaTeX math ($...$, $$...$$, \(...\), \[...\]) into sanitized,
 * high-contrast semantic HTML with clickable `[S1·C1]` citation pills.
 * @param {string} rawText
 * @param {Array} [allChunks=[]]
 * @param {{ inline?: boolean }} [opts]
 * @returns {string}
 */
export function renderRichMarkdown(rawText, allChunks = [], opts = {}) {
  const input = String(rawText ?? '');
  if (!input.trim()) return '';

  const codeBlocks = [];
  const inlineCodes = [];
  const mathBlocks = [];
  const mathInlines = [];

  let text = input.replace(/\r\n/g, '\n');

  // 1. Protect fenced code blocks
  text = text.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    const langBadge = lang ? `<span class="nb-code-lang">${escapeHtml(lang)}</span>` : '';
    codeBlocks.push(
      `<pre class="nb-code-block">${langBadge}<code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`
    );
    return `\n\n@@NBCODEBLOCK${idx}@@\n\n`;
  });

  // 2. Protect inline code spans
  text = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="nb-inline-code">${escapeHtml(code)}</code>`);
    return `@@NBCODEINLINE${idx}@@`;
  });

  // 3. Protect display math ($$...$$ and \[...\])
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
    const idx = mathBlocks.length;
    mathBlocks.push(renderLatexSafe(expr, true));
    return `\n\n@@NBMATHBLOCK${idx}@@\n\n`;
  });
  text = text.replace(/\\\[([\s\S]+?)\\\]/g, (_m, expr) => {
    const idx = mathBlocks.length;
    mathBlocks.push(renderLatexSafe(expr, true));
    return `\n\n@@NBMATHBLOCK${idx}@@\n\n`;
  });

  // 4. Protect inline math ($...$ without leading/trailing whitespace, and \(...\))
  text = text.replace(/(?<!\\)\$(?!\$)(?!\s)((?:\\.|[^$\n])+?)(?<!\s)\$/g, (_m, expr) => {
    const idx = mathInlines.length;
    mathInlines.push(renderLatexSafe(expr, false));
    return `@@NBMATHINLINE${idx}@@`;
  });
  text = text.replace(/\\\(((?:\\.|[^)\n])+?)\\\)/g, (_m, expr) => {
    const idx = mathInlines.length;
    mathInlines.push(renderLatexSafe(expr, false));
    return `@@NBMATHINLINE${idx}@@`;
  });

  // 5. Parse Markdown into HTML
  let html = marked.parse(text, { gfm: true, breaks: true });

  // 6. Enhance citations & key-value list lead-ins before expanding KaTeX MathML/SVG
  html = replaceCitationsInHtml(html, allChunks);
  html = enhanceKeyValueLists(html);

  // 7. Restore code and math placeholders
  html = html
    .replace(/<p>\s*@@NBCODEBLOCK(\d+)@@\s*<\/p>/g, (_m, i) => codeBlocks[Number(i)] || '')
    .replace(/@@NBCODEBLOCK(\d+)@@/g, (_m, i) => codeBlocks[Number(i)] || '')
    .replace(/@@NBCODEINLINE(\d+)@@/g, (_m, i) => inlineCodes[Number(i)] || '')
    .replace(/<p>\s*@@NBMATHBLOCK(\d+)@@\s*<\/p>/g, (_m, i) => mathBlocks[Number(i)] || '')
    .replace(/@@NBMATHBLOCK(\d+)@@/g, (_m, i) => mathBlocks[Number(i)] || '')
    .replace(/@@NBMATHINLINE(\d+)@@/g, (_m, i) => mathInlines[Number(i)] || '');

  // 8. Sanitize
  const sanitized = sanitizeRenderedHtml(html);

  if (opts.inline) {
    const unwrapped = sanitized.replace(/^<p>([\s\S]*)<\/p>\s*$/i, '$1');
    return `<span class="nb-markdown-body nb-markdown-inline">${unwrapped}</span>`;
  }

  return `<div class="nb-markdown-body">${sanitized}</div>`;
}

/**
 * Strip Markdown & LaTeX syntax symbols and expand math commands into spoken phrasing
 * so browser TTS reads generated notes naturally.
 */
export function stripMarkdownAndLatexForSpeech(rawText) {
  let s = String(rawText || '');
  // Remove code fences and citations
  s = s.replace(/```[a-zA-Z0-9_-]*\n?/g, ' ').replace(/```/g, ' ');
  s = s.replace(/\[([^\]]+)\]/g, ' ');

  // Expand common LaTeX fractions, roots, Greek symbols & operators before stripping $ / \
  s = s
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 over $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'square root of $1')
    .replace(/\^\\circ/g, ' degrees ')
    .replace(/\\Delta/g, 'Delta ')
    .replace(/\\alpha/g, 'alpha ')
    .replace(/\\beta/g, 'beta ')
    .replace(/\\gamma/g, 'gamma ')
    .replace(/\\theta/g, 'theta ')
    .replace(/\\lambda/g, 'lambda ')
    .replace(/\\mu/g, 'mu ')
    .replace(/\\pi/g, 'pi ')
    .replace(/\\sigma/g, 'sigma ')
    .replace(/\\omega/g, 'omega ')
    .replace(/\\rightarrow|\\to/g, ' yields ')
    .replace(/\\leftrightarrow/g, ' equilibrium ')
    .replace(/\\times/g, ' times ')
    .replace(/\\cdot/g, ' dot ')
    .replace(/\\pm/g, ' plus or minus ')
    .replace(/\\approx/g, ' approximately ')
    .replace(/\\leq/g, ' less than or equal to ')
    .replace(/\\geq/g, ' greater than or equal to ')
    .replace(/\\neq/g, ' not equal to ')
    .replace(/\\ln/g, ' natural log of ')
    .replace(/\\log/g, ' log of ');

  // Strip remaining LaTeX markers & Markdown tokens
  s = s
    .replace(/\$\$?/g, ' ')
    .replace(/\\[\[\]()]/g, ' ')
    .replace(/\\([a-zA-Z]+)/g, ' $1 ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return s;
}

/**
 * Debounced/throttled live streaming render helper to avoid layout thrashing during AI token bursts.
 */
export function createStreamRenderThrottle(renderFn, intervalMs = 80) {
  let timer = null;
  let lastRun = 0;
  let pendingText = '';

  const run = (text) => {
    lastRun = Date.now();
    renderFn(text);
  };

  return {
    update(text) {
      pendingText = text;
      const now = Date.now();
      const remaining = intervalMs - (now - lastRun);
      if (remaining <= 0) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        run(pendingText);
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          run(pendingText);
        }, remaining);
      }
    },
    flush(finalText) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      run(finalText ?? pendingText);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
}
