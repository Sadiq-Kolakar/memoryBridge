import { getSelectors, resolveElement, resolveElements } from '../utils/resolver.js';

let platformConfig = null;

async function init() {
  if (!platformConfig) {
    platformConfig = await getSelectors('gemini');
  }
}

export async function extractConversation() {
  await init();
  const turns = [];
  
  // Gemini turns might be grouped inside conversation-turn elements
  const userTurns = resolveElements(platformConfig, 'userTurn');
  const aiTurns = resolveElements(platformConfig, 'aiTurn');
  
  // Simply collect all of them in order by combining the NodeLists and sorting by DOM position
  // Or we can just interleave them if we assume strict alteration
  const allTurns = [...userTurns, ...aiTurns].sort((a, b) => {
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
  
  for (const el of allTurns) {
    let role = 'assistant';
    if (el.tagName.toLowerCase() === 'user-query' || el.matches(platformConfig.userTurn[0])) {
      role = 'user';
    }
    turns.push({ role, content: el.innerText.trim() });
  }
  
  return turns;
}

export async function injectText(text) {
  await init();
  const inputEl = resolveElement(platformConfig, 'input');
  inputEl.focus();
  inputEl.innerText = '';
  document.execCommand('insertText', false, text);
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function submitInput() {
  await init();
  const submitBtn = resolveElement(platformConfig, 'submit');
  submitBtn.removeAttribute('disabled');
  submitBtn.click();
}

export async function waitForResponse(timeoutMs = 30000) {
  await init();
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('[MemoryBridge] Timeout waiting for AI response'));
    }, timeoutMs);

    let stabilityTimeout;
    
    const observer = new MutationObserver(() => {
      const aiTurns = resolveElements(platformConfig, 'aiTurn');
      if (aiTurns.length === 0) return;
      
      const lastTurn = aiTurns[aiTurns.length - 1];
      const text = lastTurn.innerText.trim();
      if (!text) return;

      clearTimeout(stabilityTimeout);
      stabilityTimeout = setTimeout(() => {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(text);
      }, 2000);
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

export async function cleanupLastExchange() {
  await init();
  const userTurns = resolveElements(platformConfig, 'userTurn');
  const aiTurns = resolveElements(platformConfig, 'aiTurn');
  
  if (userTurns.length > 0) {
    const lastUser = userTurns[userTurns.length - 1];
    lastUser.style.display = 'none';
    lastUser.dataset.mbHidden = 'true';
  }
  
  if (aiTurns.length > 0) {
    const lastAI = aiTurns[aiTurns.length - 1];
    lastAI.style.display = 'none';
    lastAI.dataset.mbHidden = 'true';
  }
}
