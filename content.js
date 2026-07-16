(() => {
  'use strict';

  if (window.__pinoFactCheckerLoaded) return;
  window.__pinoFactCheckerLoaded = true;

  const HOST_ID = `pino-fact-checker-host-${chrome.runtime.id}`;
  const MAX_NEARBY_TEXT = 3_000;
  const VERDICT_LABELS = {
    supported: 'Supported',
    mostly_supported: 'Mostly supported',
    mixed: 'Mixed evidence',
    mostly_unsupported: 'Mostly unsupported',
    unsupported: 'Unsupported',
    unclear: 'Unclear',
  };

  let host = null;
  let root = null;
  let currentClaim = '';
  let currentResult = null;

  function cleanText(value, limit = MAX_NEARBY_TEXT) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
  }

  function findSelectedBlock(selectedText) {
    const selection = window.getSelection();
    const anchorElement = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
      ? selection.anchorNode
      : selection?.anchorNode?.parentElement;

    const directBlock = anchorElement?.closest(
      'p, li, blockquote, figcaption, dd, dt, h1, h2, h3, h4, h5, h6, article, section'
    );
    if (directBlock && cleanText(directBlock.textContent).includes(cleanText(selectedText, 160))) {
      return directBlock;
    }

    const needle = cleanText(selectedText, 120);
    if (!needle || !document.body) return null;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const nodeText = cleanText(walker.currentNode.textContent, 500);
      if (nodeText.includes(needle)) {
        return walker.currentNode.parentElement?.closest(
          'p, li, blockquote, figcaption, dd, dt, h1, h2, h3, h4, h5, h6, article, section'
        );
      }
    }
    return null;
  }

  function getNearbyText(block, selectedText) {
    if (!block) return cleanText(selectedText);

    const article = block.closest('article, main, [role="main"]');
    if (!article) return cleanText(block.textContent);

    const blocks = Array.from(article.querySelectorAll('p, li, blockquote'));
    const index = blocks.findIndex((candidate) => candidate === block || candidate.contains(block));
    if (index < 0) return cleanText(block.textContent);

    return cleanText(
      blocks
        .slice(Math.max(0, index - 1), index + 3)
        .map((candidate) => cleanText(candidate.textContent, 1_200))
        .filter(Boolean)
        .join('\n')
    );
  }

  function getPageContext(selectedText) {
    const block = findSelectedBlock(selectedText);
    const publishedAt =
      document.querySelector('meta[property="article:published_time"]')?.content ||
      document.querySelector('meta[name="date"]')?.content ||
      document.querySelector('time[datetime]')?.getAttribute('datetime') ||
      '';

    return {
      title: cleanText(document.title, 300),
      url: window.location.href,
      publishedAt: cleanText(publishedAt, 80),
      nearbyText: getNearbyText(block, selectedText),
    };
  }

  function createPanel() {
    if (host && root) return;

    host = document.createElement('div');
    host.id = HOST_ID;
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.inset = '0 auto auto 0';
    host.style.zIndex = '2147483646';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        color-scheme: light dark;
      }
      * { box-sizing: border-box; }
      .panel {
        --accent: #8a563b;
        --background: #f5f1ea;
        --border: #d9d3c8;
        --ink: #25221e;
        --muted: #6f685f;
        --surface: #fffdf8;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: 0 22px 60px rgba(45, 35, 28, 0.22);
        color: var(--ink);
        display: none;
        font-family: "Avenir Next", Avenir, "Segoe UI", system-ui, sans-serif;
        font-size: 14px;
        max-height: min(78vh, 720px);
        max-width: calc(100vw - 32px);
        min-height: 250px;
        min-width: 320px;
        overflow: auto;
        position: fixed;
        resize: both;
        right: 18px;
        top: 18px;
        width: 430px;
        -webkit-font-smoothing: antialiased;
      }
      .panel.visible { display: block; }
      .header {
        align-items: center;
        background: var(--background);
        border-bottom: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        padding: 13px 15px;
        position: sticky;
        top: 0;
        z-index: 1;
      }
      .brand { align-items: center; display: flex; gap: 9px; }
      .brand img { border-radius: 9px; height: 30px; width: 30px; }
      .brand strong { font-size: 14px; letter-spacing: -0.02em; }
      .close {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 7px;
        color: var(--muted);
        cursor: pointer;
        display: inline-flex;
        font: 600 19px/1 system-ui, sans-serif;
        height: 30px;
        justify-content: center;
        width: 30px;
      }
      .close:hover { background: rgba(138, 86, 59, 0.08); color: var(--ink); }
      .content { padding: 18px; }
      .kicker {
        color: var(--accent);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        margin: 0 0 5px;
        text-transform: uppercase;
      }
      h2, h3, p { margin-top: 0; }
      h2 { font-size: 22px; letter-spacing: -0.04em; line-height: 1.15; margin-bottom: 8px; }
      h3 { font-size: 12px; letter-spacing: 0.01em; margin: 20px 0 7px; }
      p { line-height: 1.58; }
      .muted { color: var(--muted); }
      .claim {
        border-left: 3px solid var(--border);
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
        margin: 13px 0 0;
        max-height: 76px;
        overflow: hidden;
        padding-left: 10px;
      }
      .skeleton { display: grid; gap: 9px; margin-top: 20px; }
      .skeleton span {
        animation: pulse 1.25s ease-in-out infinite alternate;
        background: #e8e1d6;
        border-radius: 5px;
        display: block;
        height: 12px;
      }
      .skeleton span:nth-child(2) { width: 86%; }
      .skeleton span:nth-child(3) { width: 67%; }
      @keyframes pulse { from { opacity: 0.46; } to { opacity: 1; } }
      .verdict-row { align-items: center; display: flex; flex-wrap: wrap; gap: 9px; margin: 12px 0 18px; }
      .verdict {
        background: #eee7dc;
        border-radius: 999px;
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        padding: 6px 10px;
      }
      .confidence { color: var(--muted); font-size: 11px; }
      .section-text { color: var(--ink); margin-bottom: 0; white-space: pre-wrap; }
      .section-text a { color: var(--accent); font-weight: 700; text-decoration: none; }
      .section-text a:hover { text-decoration: underline; }
      .sources { list-style: none; margin: 8px 0 0; padding: 0; }
      .sources li { border-top: 1px solid var(--border); padding: 10px 0; }
      .sources a { color: var(--ink); display: block; font-size: 12px; font-weight: 700; line-height: 1.35; text-decoration: none; }
      .sources a:hover { color: var(--accent); }
      .source-meta { color: var(--muted); display: block; font-size: 10px; margin-top: 3px; }
      .notice {
        background: var(--background);
        border-radius: 10px;
        color: var(--muted);
        font-size: 11px;
        line-height: 1.45;
        margin-top: 16px;
        padding: 10px 11px;
      }
      .actions { display: flex; margin-top: 14px; }
      .copy {
        background: var(--accent);
        border: 1px solid var(--accent);
        border-radius: 9px;
        color: #fff;
        cursor: pointer;
        font: 700 12px/1 system-ui, sans-serif;
        min-height: 38px;
        padding: 0 14px;
      }
      .copy:active { transform: translateY(1px); }
      .error-title { color: #963d34; }
      @media (prefers-color-scheme: dark) {
        .panel {
          --background: #211e1a;
          --border: #413b34;
          --ink: #f2ede4;
          --muted: #b5ada2;
          --surface: #2a2621;
          box-shadow: 0 22px 60px rgba(0, 0, 0, 0.4);
        }
        .skeleton span { background: #403930; }
        .verdict { background: #40362e; }
      }
      @media (max-width: 520px) {
        .panel {
          max-height: calc(100dvh - 24px);
          max-width: calc(100vw - 24px);
          min-width: 0;
          right: 12px;
          top: 12px;
          width: calc(100vw - 24px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .skeleton span { animation: none; }
      }
    `;

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Pino fact-check result');

    const header = document.createElement('header');
    header.className = 'header';
    const brand = document.createElement('div');
    brand.className = 'brand';
    const logo = document.createElement('img');
    logo.src = chrome.runtime.getURL('icons/icon48.png');
    logo.alt = '';
    const brandName = document.createElement('strong');
    brandName.textContent = 'Pino Fact Checker';
    brand.append(logo, brandName);

    const closeButton = document.createElement('button');
    closeButton.className = 'close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close fact-check');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', hidePanel);
    header.append(brand, closeButton);

    const content = document.createElement('div');
    content.className = 'content';
    content.id = 'content';
    panel.append(header, content);
    root.append(style, panel);
  }

  function getPanel() {
    createPanel();
    return root.querySelector('.panel');
  }

  function getContent() {
    return root.querySelector('#content');
  }

  function showPanel() {
    getPanel().classList.add('visible');
  }

  function hidePanel() {
    getPanel().classList.remove('visible');
  }

  function addTextElement(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function appendTextWithCitations(parent, text, sources) {
    const sourceList = Array.isArray(sources) ? sources : [];
    const pattern = /\[(\d+)\]/g;
    let cursor = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      const source = sourceList[Number(match[1]) - 1];
      if (source?.url) {
        const link = document.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = match[0];
        parent.appendChild(link);
      } else {
        parent.appendChild(document.createTextNode(match[0]));
      }
      cursor = pattern.lastIndex;
    }
    parent.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function renderLoading(claim) {
    currentClaim = claim || '';
    currentResult = null;
    const content = getContent();
    content.replaceChildren();
    addTextElement(content, 'p', 'kicker', 'Checking the claim');
    addTextElement(content, 'h2', '', 'Searching for reliable evidence');
    addTextElement(content, 'p', 'muted', 'Pino is asking Perplexity to compare the selected claim against current sources.');
    addTextElement(content, 'p', 'claim', currentClaim);

    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
    content.appendChild(skeleton);
    showPanel();
  }

  function renderError(message) {
    currentResult = null;
    const content = getContent();
    content.replaceChildren();
    addTextElement(content, 'p', 'kicker', 'Could not complete the check');
    addTextElement(content, 'h2', 'error-title', 'Pino needs attention');
    addTextElement(content, 'p', 'section-text', message || 'The fact-check could not be completed.');
    addTextElement(content, 'p', 'notice', 'Open the Pino toolbar popup to add or replace the API key, then try again.');
    showPanel();
  }

  function addResultSection(content, heading, text, sources) {
    if (!text) return;
    addTextElement(content, 'h3', '', heading);
    const paragraph = document.createElement('p');
    paragraph.className = 'section-text';
    appendTextWithCitations(paragraph, text, sources);
    content.appendChild(paragraph);
  }

  function addSources(content, sources) {
    if (!Array.isArray(sources) || sources.length === 0) return;
    addTextElement(content, 'h3', '', `Sources (${sources.length})`);
    const list = document.createElement('ol');
    list.className = 'sources';

    for (const source of sources) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title || source.url;
      item.appendChild(link);

      let hostname = '';
      try {
        hostname = new URL(source.url).hostname.replace(/^www\./, '');
      } catch {
        hostname = '';
      }
      const meta = [hostname, source.date].filter(Boolean).join(' · ');
      if (meta) addTextElement(item, 'span', 'source-meta', meta);
      list.appendChild(item);
    }
    content.appendChild(list);
  }

  function formatCopyText() {
    if (!currentResult) return '';
    const lines = [
      'Pino Fact Check',
      `Claim: ${currentClaim}`,
      `Verdict: ${VERDICT_LABELS[currentResult.verdict] || 'Unclear'}`,
      `Confidence: ${currentResult.confidence}%`,
      '',
      `Summary: ${currentResult.summary}`,
      currentResult.context ? `Context: ${currentResult.context}` : '',
      currentResult.limitations ? `Limitations: ${currentResult.limitations}` : '',
      '',
      'Sources:',
      ...(currentResult.sources || []).map((source, index) => `${index + 1}. ${source.title} — ${source.url}`),
      '',
      'AI-generated analysis. Verify important claims against the original sources.',
    ];
    return lines.filter((line, index) => line || lines[index - 1] !== '').join('\n');
  }

  async function copyResult(button) {
    try {
      await navigator.clipboard.writeText(formatCopyText());
      button.textContent = 'Copied';
      setTimeout(() => {
        button.textContent = 'Copy result';
      }, 1_500);
    } catch {
      button.textContent = 'Copy failed';
    }
  }

  function renderResult(claim, result) {
    currentClaim = claim || currentClaim;
    currentResult = result;
    const content = getContent();
    content.replaceChildren();

    addTextElement(content, 'p', 'kicker', 'Evidence review');
    addTextElement(content, 'h2', '', VERDICT_LABELS[result.verdict] || 'Unclear');

    const verdictRow = document.createElement('div');
    verdictRow.className = 'verdict-row';
    addTextElement(verdictRow, 'span', 'verdict', VERDICT_LABELS[result.verdict] || 'Unclear');
    addTextElement(verdictRow, 'span', 'confidence', `${result.confidence}% confidence in this verdict`);
    content.appendChild(verdictRow);

    addResultSection(content, 'Summary', result.summary, result.sources);
    addResultSection(content, 'Context', result.context, result.sources);
    addResultSection(content, 'Limitations', result.limitations, result.sources);
    addSources(content, result.sources);
    addTextElement(
      content,
      'p',
      'notice',
      'This is AI-generated analysis, not a definitive truth score. Open the sources and verify important claims yourself.'
    );

    const actions = document.createElement('div');
    actions.className = 'actions';
    const copyButton = document.createElement('button');
    copyButton.className = 'copy';
    copyButton.type = 'button';
    copyButton.textContent = 'Copy result';
    copyButton.addEventListener('click', () => copyResult(copyButton));
    actions.appendChild(copyButton);
    content.appendChild(actions);
    showPanel();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== 'object') return false;

    if (message.action === 'getPageContext') {
      sendResponse(getPageContext(message.selectedText));
      return false;
    }
    if (message.action === 'showLoading') {
      renderLoading(message.claim);
      return false;
    }
    if (message.action === 'factCheckResult') {
      renderResult(message.claim, message.data);
      return false;
    }
    if (message.action === 'factCheckError') {
      renderError(message.error);
      return false;
    }
    return false;
  });
})();
