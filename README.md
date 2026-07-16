# Pino — Fact Checker

Pino is a free, open-source Chrome extension that fact-checks highlighted text with the Perplexity API. There is no Pino account, sign-in, subscription, credit pack, or developer-hosted API. Each user supplies their own Perplexity API key and pays any API charges directly to Perplexity.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/pino-fact-checker/olfaipihfeomkedngnkkmappbojmlmml)

## How it works

1. Open the Pino toolbar popup and save a Perplexity API key.
2. Highlight a factual claim on a regular webpage.
3. Right-click and choose **Fact-check with Pino**.
4. Read the verdict, explanation, limitations, and original sources.

Pino uses Perplexity's `sonar` model by default. Users can choose `sonar-pro` for a deeper, typically more expensive search.

## Privacy model

- The API key is stored in `chrome.storage.local`, not synced through a Google account.
- Local storage is restricted to trusted extension contexts on supported Chrome versions.
- On an explicit fact-check, Pino sends the selected claim, up to 3,000 characters of nearby text, the page title, publication date when available, and the page URL without query parameters.
- The request goes directly from Chrome to Perplexity over HTTPS.
- Pino has no analytics, developer backend, advertising, email collection, or remote fact-check history.
- Results are rendered with DOM text nodes and source URLs returned by Perplexity's `search_results` field.

Read the public [Privacy Policy](https://pino-fact-checker-legal.vercel.app/privacy.html) and [Terms of Use](https://pino-fact-checker-legal.vercel.app/terms.html). The same pages are bundled with the extension for offline access.

## Important limitation

Pino is an AI-assisted research tool, not an authoritative fact-checking organization. Its confidence value describes the model's confidence in its verdict; it is not a mathematical probability that a claim is true. Users should open and evaluate the cited sources before relying on a result.

## Local development

Requirements: Chrome and Node.js 20 or later.

```bash
npm test
npm run build
```

To load the extension without packaging:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this repository folder.

The packaged store upload is written to `dist/pino-fact-checker-3.0.0.zip`.

## Permissions

| Permission | Why it is required |
|---|---|
| `contextMenus` | Adds the fact-check action when text is selected. |
| `storage` | Stores the user's API key and model choice locally. |
| `https://api.perplexity.ai/*` | Sends user-initiated fact-check requests directly to Perplexity. |
| Page content script on HTTP/HTTPS | Reads only the selected claim and limited nearby context, then displays the result. |

## License

MIT. See [LICENSE](LICENSE).
