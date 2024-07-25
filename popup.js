document.addEventListener('DOMContentLoaded', () => {
  const saveButton = document.getElementById('saveApiKey');
  const apiKeyInput = document.getElementById('apiKey');
  const status = document.getElementById('status');

  // Load the saved API key
  chrome.storage.sync.get('apiKey', (data) => {
    if (data.apiKey) {
      apiKeyInput.value = data.apiKey;
    }
  });

  // Save the API key when the button is clicked
  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({ apiKey }, () => {
        status.textContent = 'API Key saved!';
        status.className = 'success';
        setTimeout(() => {
          status.textContent = '';
          status.className = '';
        }, 2000);
      });
    } else {
      status.textContent = 'Please enter a valid API Key.';
      status.className = 'error';
    }
  });
});
