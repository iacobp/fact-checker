import {
  buildFactCheckRequest,
  createApiError,
  normalizeText,
  parseFactCheckResponse,
} from './core.js';

const API_URL = 'https://api.perplexity.ai/v1/sonar';
const API_KEY_STORAGE_KEY = 'perplexityApiKey';
const MODEL_STORAGE_KEY = 'perplexityModel';
const MENU_ID = 'pinoFactCheck';
const REQUEST_TIMEOUT_MS = 60_000;

const LEGACY_SYNC_KEYS = [
  'advancedSearchesThisMonth',
  'credits',
  'domainFilters',
  'freeSearchesLeft',
  'hasPurchasedPerplexityUnlock',
  'isSubscribed',
  'language',
  'perplexityApiKey',
  'perplexityApiKeyEnabled',
  'searchMode',
  'subscriptionData',
  'theme',
  'trialExpired',
  'userId',
];

const LEGACY_LOCAL_KEYS = [
  'currentUser',
  'factChecks',
  'lastSessionUpdate',
  'stripePortalLastAccessed',
  'supabaseSession',
  'userProfile',
];

async function restrictLocalStorageAccess() {
  try {
    await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  } catch {
    // Older Chromium versions do not expose setAccessLevel. The extension still
    // works, but current Chrome versions should always take this path.
  }
}

async function migrateLegacySettings() {
  const [localData, syncData] = await Promise.all([
    chrome.storage.local.get([API_KEY_STORAGE_KEY, MODEL_STORAGE_KEY]),
    chrome.storage.sync.get(['perplexityApiKey', 'searchMode']),
  ]);

  const updates = {};
  if (!localData[API_KEY_STORAGE_KEY] && typeof syncData.perplexityApiKey === 'string') {
    const legacyKey = syncData.perplexityApiKey.trim();
    if (legacyKey) updates[API_KEY_STORAGE_KEY] = legacyKey;
  }

  if (!localData[MODEL_STORAGE_KEY]) {
    updates[MODEL_STORAGE_KEY] = syncData.searchMode === 'advanced' ? 'sonar-pro' : 'sonar';
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }

  await Promise.all([
    chrome.storage.sync.remove(LEGACY_SYNC_KEYS),
    chrome.storage.local.remove(LEGACY_LOCAL_KEYS),
  ]);
}

async function createContextMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Fact-check with Pino',
    contexts: ['selection'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

async function initializeExtension() {
  await restrictLocalStorageAccess();
  await migrateLegacySettings();
  await createContextMenu();
}

chrome.runtime.onInstalled.addListener(() => {
  initializeExtension().catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  initializeExtension().catch(() => undefined);
});

async function sendTabMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}

async function getPageContext(tabId, selectedText, tab) {
  const context = await sendTabMessage(tabId, {
    action: 'getPageContext',
    selectedText,
  });

  return context || {
    title: tab.title || '',
    url: tab.url || '',
    publishedAt: '',
    nearbyText: '',
  };
}

async function callPerplexity({ apiKey, claim, context, model }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildFactCheckRequest({ claim, context, model })),
      signal: controller.signal,
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (!response.ok) {
      throw createApiError(response.status, payload);
    }

    return parseFactCheckResponse(payload);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The fact-check timed out. Try a shorter claim or try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleFactCheck(info, tab) {
  if (!tab?.id) return;

  const claim = normalizeText(info.selectionText, 8_000);
  if (!claim) return;

  const { [API_KEY_STORAGE_KEY]: apiKey, [MODEL_STORAGE_KEY]: storedModel } =
    await chrome.storage.local.get([API_KEY_STORAGE_KEY, MODEL_STORAGE_KEY]);

  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    await sendTabMessage(tab.id, {
      action: 'factCheckError',
      error: 'Add your Perplexity API key in the Pino toolbar popup first.',
    });
    return;
  }

  await sendTabMessage(tab.id, { action: 'showLoading', claim });

  try {
    const context = await getPageContext(tab.id, claim, tab);
    const result = await callPerplexity({
      apiKey: apiKey.trim(),
      claim,
      context,
      model: storedModel === 'sonar-pro' ? 'sonar-pro' : 'sonar',
    });

    await sendTabMessage(tab.id, {
      action: 'factCheckResult',
      claim,
      data: result,
    });
  } catch (error) {
    await sendTabMessage(tab.id, {
      action: 'factCheckError',
      error: error?.message || 'The fact-check could not be completed.',
    });
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  handleFactCheck(info, tab).catch(() => undefined);
});

restrictLocalStorageAccess().catch(() => undefined);
