import * as ObsidianClient from './obsidian-client.js';
import { checkDuplicate, addHashToIndex } from './deduplication.js';
import { buildMarkdown, sanitizeFilename, generateFilename } from './memory-schema.js';

// Setup alarms
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('flushQueue', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flushQueue') {
    flushQueue();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_MEMORY') {
    handleSaveMemory(message.payload).then(sendResponse);
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'SEARCH_MEMORY') {
    ObsidianClient.searchNotes(message.query)
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'FETCH_ALL_MEMORIES') {
    ObsidianClient.listNotes()
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'READ_NOTE') {
    ObsidianClient.readNote(message.filename)
      .then(res => sendResponse({ success: true, data: res }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  if (message.type === 'CHECK_VAULT') {
    ObsidianClient.healthCheck()
      .then(res => sendResponse({ success: true, status: res.ok ? 'online' : 'offline', error: res.error }))
      .catch((e) => sendResponse({ success: true, status: 'offline', error: e.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get(null).then(sendResponse);
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set(message.payload).then(() => sendResponse({ success: true }));
    return true;
  }
});

async function handleSaveMemory({ memoryNote, platform, rawConversationArray }) {
  try {
    const rawString = JSON.stringify(rawConversationArray);
    
    // Deduplication check
    const { isDuplicate, hash } = await checkDuplicate(rawString);
    if (isDuplicate) {
      return { success: true, status: 'duplicate', skipped: true };
    }
    
    // Find related memories by searching for shared tags
    const relatedNotes = await findRelatedNotes(memoryNote.tags || []);
    
    const filename = generateFilename(memoryNote.title, platform);
    const markdown = buildMarkdown(memoryNote, platform, rawString, hash, relatedNotes);
    
    try {
      await ObsidianClient.saveNote(filename, markdown);
      await addHashToIndex(hash);
      return { success: true, status: 'saved' };
    } catch (saveError) {
      // Offline queue fallback
      await queueMemorySave(filename, markdown, hash);
      return { success: true, status: 'queued' };
    }
  } catch (error) {
    console.error('[MemoryBridge] Error in handleSaveMemory:', error);
    return { success: false, error: error.message };
  }
}

async function findRelatedNotes(tags) {
  if (!tags || tags.length === 0) return [];
  
  try {
    // Search the vault for notes that mention any of the current tags
    const searchTag = tags[0]; // Use the primary tag for search
    const results = await ObsidianClient.searchNotes(searchTag);
    
    if (!results || !Array.isArray(results)) return [];
    
    // Extract filenames, clean them for wikilinks, max 5 related
    return results
      .map(r => r.filename || '')
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace(/\.md$/, ''))                   // Strip .md
      .map(f => f.replace(/^MemoryBridge\//, ''))          // Strip folder prefix
      .filter(f => f.length > 0)
      .slice(0, 5);
  } catch (e) {
    // If search fails (vault offline, no results), just skip linking
    return [];
  }
}

async function queueMemorySave(filename, markdown, hash) {
  const data = await chrome.storage.local.get('mb_save_queue');
  const queue = data.mb_save_queue || [];
  queue.push({ filename, content: markdown, hash, timestamp: Date.now() });
  await chrome.storage.local.set({ mb_save_queue: queue });
}

async function flushQueue() {
  const healthResult = await ObsidianClient.healthCheck();
  if (!healthResult.ok) return;
  
  const data = await chrome.storage.local.get('mb_save_queue');
  let queue = data.mb_save_queue || [];
  
  if (queue.length === 0) return;
  
  const failedItems = [];
  
  for (const item of queue) {
    try {
      await ObsidianClient.saveNote(item.filename, item.content);
      await addHashToIndex(item.hash);
    } catch (error) {
      failedItems.push(item);
    }
  }
  
  await chrome.storage.local.set({ mb_save_queue: failedItems });
}
