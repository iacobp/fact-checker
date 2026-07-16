# Chrome Web Store copy for Pino 3.0

## Name

Pino - Fact Checker

## Short description

Fact-check highlighted text with Perplexity. Free extension; bring your own API key.

## Full description

Pino gives you a fast second look at factual claims while you browse.

Highlight text on a webpage, right-click, and choose “Fact-check with Pino.” Pino asks Perplexity to search for evidence, then shows a clear verdict, a concise explanation, relevant context, limitations, and links to the original sources.

Pino 3.0 is free and bring-your-own-key:

- No Pino account or Google sign-in
- No subscription, trial, credit pack, or unlock fee
- No ads or analytics
- No developer-hosted AI proxy
- Your Perplexity API key is stored in this Chrome profile
- Requests go directly from Chrome to Perplexity

Perplexity API usage is separate from Pino. Perplexity may require a payment method or API credits and may charge for requests under its own pricing and terms. Pino defaults to Sonar for lower API cost; Sonar Pro is available as an optional deeper-search model.

Data minimization:

Pino sends only the text you explicitly select, limited nearby text for context, the page title, an available publication date, and the page URL with query parameters removed. Pino does not send the full page, maintain a developer-side search history, collect your email address, or track browsing activity.

Important: AI fact-checks can be wrong or incomplete. The confidence value is confidence in the model's verdict, not a mathematical “truth percentage.” Always open the cited sources before relying on an important result.

## Single purpose

Pino fact-checks user-selected claims with Perplexity and displays the supporting analysis and source links.

## Permission justifications

- `contextMenus`: provides the right-click fact-check command for selected text.
- `storage`: stores the user's Perplexity API key and model preference locally.
- `https://api.perplexity.ai/*`: sends user-initiated requests directly to Perplexity.
- HTTP/HTTPS content script access: reads the selected text and limited nearby context only after the user requests a fact-check, and renders the result on that page.

## Version 3.0 release notes

- Made Pino free and bring-your-own-key for everyone.
- Removed Google sign-in, Supabase, Stripe, trials, credits, subscriptions, and unlock fees.
- Reduced permissions and removed developer backend access.
- Moved API keys from synced storage to device-local storage.
- Stopped collecting full article text.
- Updated to Perplexity's canonical Sonar endpoint and structured output.
- Uses Perplexity search results for source URLs.
- Added clear privacy and terms pages.

## Legal URLs

- Privacy Policy: https://pino-fact-checker-legal.vercel.app/privacy.html
- Terms of Use: https://pino-fact-checker-legal.vercel.app/terms.html
