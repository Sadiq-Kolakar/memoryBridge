import { hashString } from './utils/md5.js';

export async function checkDuplicate(rawConversationString) {
  const hash = await hashString(rawConversationString);
  const data = await chrome.storage.local.get('mb_hash_index');
  const index = data.mb_hash_index || [];
  
  if (index.includes(hash)) {
    return { isDuplicate: true, hash };
  }
  
  return { isDuplicate: false, hash };
}

export async function addHashToIndex(hash) {
  const data = await chrome.storage.local.get('mb_hash_index');
  const index = data.mb_hash_index || [];
  
  if (!index.includes(hash)) {
    index.push(hash);
    
    // Keep index size manageable, e.g. last 10000 items
    if (index.length > 10000) {
      index.shift();
    }
    
    await chrome.storage.local.set({ mb_hash_index: index });
  }
}
