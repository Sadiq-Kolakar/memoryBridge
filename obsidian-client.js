const BASE_URL = 'http://127.0.0.1:27123';

async function getVaultFolder() {
  const { obsidianVaultFolder } = await chrome.storage.local.get('obsidianVaultFolder');
  return obsidianVaultFolder || 'MemoryBridge';
}

async function getHeaders() {
  const { obsidianApiKey } = await chrome.storage.local.get('obsidianApiKey');
  return {
    'Authorization': `Bearer ${obsidianApiKey}`,
    'Content-Type': 'text/markdown'
  };
}

export async function saveNote(filename, markdownContent) {
  try {
    const headers = await getHeaders();
    const folder = await getVaultFolder();
    const path = encodeURIComponent(`${folder}/${filename}.md`);
    const response = await fetch(`${BASE_URL}/vault/${path}`, {
      method: 'PUT',
      headers,
      body: markdownContent
    });
    if (!response.ok) throw new Error(`Save failed: ${response.status}`);
    return true;
  } catch (error) {
    console.error('[MemoryBridge] Failed to save note:', error);
    throw error;
  }
}

export async function searchNotes(query) {
  try {
    const headers = await getHeaders();
    const response = await fetch(
      `${BASE_URL}/search/simple?query=${encodeURIComponent(query)}&contextLength=200`,
      { method: 'POST', headers }
    );
    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[MemoryBridge] Failed to search notes:', error);
    throw error;
  }
}

export async function readNote(filename) {
  try {
    const headers = await getHeaders();
    const folder = await getVaultFolder();
    const path = encodeURIComponent(`${folder}/${filename}.md`);
    const response = await fetch(`${BASE_URL}/vault/${path}`, {
      method: 'GET',
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
    if (!response.ok) throw new Error(`Read failed: ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error('[MemoryBridge] Failed to read note:', error);
    throw error;
  }
}

export async function listNotes() {
  try {
    const headers = await getHeaders();
    const folder = await getVaultFolder();
    const path = encodeURIComponent(`${folder}/`);
    const response = await fetch(`${BASE_URL}/vault/${path}`, {
      method: 'GET',
      headers
    });
    if (response.status === 404) return { files: [] };
    if (!response.ok) throw new Error(`List failed: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('[MemoryBridge] Failed to list notes:', error);
    throw error;
  }
}

export async function healthCheck() {
  try {
    const headers = await getHeaders();
    const response = await fetch(`${BASE_URL}/`, { headers });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
