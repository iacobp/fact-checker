(() => {
  'use strict';

  const API_KEY_STORAGE_KEY = 'perplexityApiKey';
  const MODEL_STORAGE_KEY = 'perplexityModel';

  const apiKeyInput = document.getElementById('apiKey');
  const keyState = document.getElementById('keyState');
  const modelSelect = document.getElementById('model');
  const removeButton = document.getElementById('removeKey');
  const saveButton = document.getElementById('saveKey');
  const changeButton = document.getElementById('changeKey');
  const status = document.getElementById('status');
  const toggleButton = document.getElementById('toggleKey');

  let savedKey = '';

  function maskKey(value) {
    if (value.length < 10) return 'Saved locally';
    return `${value.slice(0, 5)}…${value.slice(-4)}`;
  }

  function setStatus(message, type = '') {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function renderKeyState() {
    const hasKey = Boolean(savedKey);
    keyState.textContent = hasKey ? 'Ready' : 'Not saved';
    keyState.classList.toggle('ready', hasKey);
    apiKeyInput.value = '';
    apiKeyInput.disabled = hasKey;
    apiKeyInput.placeholder = hasKey ? maskKey(savedKey) : 'Paste your key';
    toggleButton.hidden = hasKey;
    saveButton.hidden = hasKey;
    changeButton.hidden = !hasKey;
    removeButton.hidden = !hasKey;
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get([API_KEY_STORAGE_KEY, MODEL_STORAGE_KEY]);
    savedKey = typeof data[API_KEY_STORAGE_KEY] === 'string'
      ? data[API_KEY_STORAGE_KEY].trim()
      : '';
    modelSelect.value = data[MODEL_STORAGE_KEY] === 'sonar-pro' ? 'sonar-pro' : 'sonar';
    renderKeyState();
  }

  async function saveKey() {
    const value = apiKeyInput.value.trim();
    if (value.length < 8 || /\s/.test(value)) {
      setStatus('Paste a complete API key with no spaces.', 'error');
      return;
    }

    await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: value });
    savedKey = value;
    renderKeyState();
    setStatus('Key saved. Pino is ready to use.', 'success');
  }

  function changeKey() {
    savedKey = '';
    renderKeyState();
    apiKeyInput.focus();
    setStatus('Paste the replacement key, then save it.');
  }

  async function removeKey() {
    await chrome.storage.local.remove(API_KEY_STORAGE_KEY);
    savedKey = '';
    renderKeyState();
    setStatus('Key removed from this Chrome profile.', 'success');
  }

  function toggleKeyVisibility() {
    const shouldShow = apiKeyInput.type === 'password';
    apiKeyInput.type = shouldShow ? 'text' : 'password';
    toggleButton.textContent = shouldShow ? 'Hide' : 'Show';
    toggleButton.setAttribute('aria-label', shouldShow ? 'Hide API key' : 'Show API key');
  }

  async function saveModel() {
    const model = modelSelect.value === 'sonar-pro' ? 'sonar-pro' : 'sonar';
    await chrome.storage.local.set({ [MODEL_STORAGE_KEY]: model });
    setStatus(model === 'sonar-pro' ? 'Sonar Pro selected. API usage may cost more.' : 'Sonar selected for lower API cost.');
  }

  saveButton.addEventListener('click', saveKey);
  changeButton.addEventListener('click', changeKey);
  removeButton.addEventListener('click', removeKey);
  toggleButton.addEventListener('click', toggleKeyVisibility);
  modelSelect.addEventListener('change', saveModel);
  apiKeyInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') saveKey();
  });

  loadSettings().catch(() => setStatus('Chrome could not load the saved settings.', 'error'));
})();
