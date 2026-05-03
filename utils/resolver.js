export async function getSelectors(platform) {
  try {
    const url = chrome.runtime.getURL('selectors.json');
    const response = await fetch(url);
    const config = await response.json();
    return config.platforms[platform];
  } catch (error) {
    console.error(`[MemoryBridge] Failed to load selectors for ${platform}`, error);
    return null;
  }
}

export function resolveElement(selectorsConfig, key, context = document) {
  if (!selectorsConfig || !selectorsConfig[key]) {
    throw new Error(`[MemoryBridge] No selector config found for key: ${key}`);
  }
  
  const selectors = selectorsConfig[key];
  for (const sel of selectors) {
    const el = context.querySelector(sel);
    if (el) return el;
  }
  
  throw new Error(`[MemoryBridge] No selector found for ${key} (tried ${selectors.join(', ')})`);
}

export function resolveElements(selectorsConfig, key, context = document) {
  if (!selectorsConfig || !selectorsConfig[key]) {
    throw new Error(`[MemoryBridge] No selector config found for key: ${key}`);
  }
  
  const selectors = selectorsConfig[key];
  for (const sel of selectors) {
    const els = context.querySelectorAll(sel);
    if (els.length > 0) return Array.from(els);
  }
  
  return [];
}
