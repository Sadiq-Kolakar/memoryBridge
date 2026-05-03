document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('vault-status-dot');
  const statusText = document.getElementById('vault-status-text');
  const memoryCount = document.getElementById('memory-count');
  
  chrome.runtime.sendMessage({ type: 'CHECK_VAULT' }, (res) => {
    if (res && res.status === 'online') {
      statusDot.className = 'dot online';
      statusText.innerText = 'Connected';
    } else {
      statusDot.className = 'dot offline';
      statusText.innerText = res && res.error ? `Offline: ${res.error}` : 'Offline';
    }
  });

  chrome.runtime.sendMessage({ type: 'FETCH_ALL_MEMORIES' }, (res) => {
    if (res && res.success && res.data.files) {
      memoryCount.innerText = `${res.data.files.length} memories saved`;
    }
  });

  document.getElementById('capture-btn').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_NOW' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('MemoryBridge: Please open a ChatGPT, Claude, Gemini, or NotebookLM tab to capture a conversation!');
        } else {
          window.close();
        }
      });
    });
  });

  document.getElementById('open-vault-btn').addEventListener('click', async () => {
    const { obsidianVaultFolder } = await chrome.storage.local.get('obsidianVaultFolder');
    const folder = obsidianVaultFolder || 'MemoryBridge';
    chrome.tabs.create({ url: `obsidian://open?vault=${folder}` });
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  });
});
