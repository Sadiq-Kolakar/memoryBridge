document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const vaultFolderInput = document.getElementById('vault-folder');
  const saveBtn = document.getElementById('save-btn');
  const statusEl = document.getElementById('status');

  // Load existing settings
  const settings = await new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, resolve);
  });

  if (settings.obsidianApiKey) apiKeyInput.value = settings.obsidianApiKey;
  if (settings.obsidianVaultFolder) vaultFolderInput.value = settings.obsidianVaultFolder;

  saveBtn.addEventListener('click', async () => {
    const obsidianApiKey = apiKeyInput.value.trim();
    const obsidianVaultFolder = vaultFolderInput.value.trim() || 'MemoryBridge';

    if (!obsidianApiKey) {
      statusEl.innerText = 'API key is required';
      statusEl.className = 'status error';
      return;
    }

    statusEl.innerText = 'Saving...';
    statusEl.className = 'status';

    await new Promise(resolve => {
      chrome.runtime.sendMessage({ 
        type: 'SAVE_SETTINGS', 
        payload: { obsidianApiKey, obsidianVaultFolder } 
      }, resolve);
    });

    // Test connection
    chrome.runtime.sendMessage({ type: 'CHECK_VAULT' }, (res) => {
      if (res && res.status === 'online') {
        statusEl.innerText = '✅ Connection successful! You can now use MemoryBridge on AI sites.';
        statusEl.className = 'status success';
      } else {
        statusEl.innerText = '❌ Connection failed. Is Obsidian open with the plugin enabled?';
        statusEl.className = 'status error';
      }
    });
  });
});
