import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFactCheckRequest,
  collectSources,
  createApiError,
  normalizeText,
  parseFactCheckResponse,
  sanitizePageUrl,
} from '../core.js';

test('normalizes whitespace and limits text', () => {
  assert.equal(normalizeText('  one\n\n two  ', 7), 'one two');
});

test('removes URL query parameters and fragments', () => {
  assert.equal(
    sanitizePageUrl('https://example.com/story?id=private#section'),
    'https://example.com/story'
  );
  assert.equal(sanitizePageUrl('javascript:alert(1)'), '');
});

test('builds a structured Sonar request without full-page data', () => {
  const request = buildFactCheckRequest({
    claim: 'The claim.',
    context: {
      title: 'Article',
      url: 'https://example.com/a?token=secret',
      nearbyText: 'Nearby text',
      fullText: 'This must never be included',
    },
    model: 'sonar-pro',
  });

  assert.equal(request.model, 'sonar-pro');
  assert.equal(request.response_format.type, 'json_schema');
  assert.match(request.messages[1].content, /https:\/\/example\.com\/a/);
  assert.doesNotMatch(request.messages[1].content, /token=secret|fullText|must never/);
});

test('parses structured output and uses API search results as sources', () => {
  const result = parseFactCheckResponse({
    model: 'sonar',
    choices: [{
      message: {
        content: JSON.stringify({
          verdict: 'mixed',
          confidence: 73.6,
          summary: 'Evidence is mixed [1].',
          context: 'More context.',
          limitations: 'One source is old.',
        }),
      },
    }],
    search_results: [
      { title: 'Primary source', url: 'https://example.org/report', date: '2026-07-10' },
      { title: 'Duplicate', url: 'https://example.org/report' },
      { title: 'Unsafe', url: 'javascript:alert(1)' },
    ],
  });

  assert.equal(result.verdict, 'mixed');
  assert.equal(result.confidence, 74);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].title, 'Primary source');
});

test('falls back to citation URLs when search results are unavailable', () => {
  assert.deepEqual(collectSources({ citations: ['https://example.net/a'] }), [{
    title: 'example.net',
    url: 'https://example.net/a',
    date: '',
  }]);
});

test('maps common API failures to useful messages', () => {
  assert.match(createApiError(401).message, /rejected the API key/i);
  assert.match(createApiError(429).message, /rate-limiting/i);
  assert.match(createApiError(503).message, /temporarily unavailable/i);
});
