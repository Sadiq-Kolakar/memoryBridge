import { getSelectors, resolveElement, resolveElements } from '../utils/resolver.js';

let platformConfig = null;

async function init() {
  if (!platformConfig) {
    platformConfig = await getSelectors('claude');
  }
}

export async function extractConversation() {
  await init();
  const turns = [];
  
  // Try to find both human and AI turns
  const humanTurnSelectors = platformConfig.humanTurn;
  const aiTurnSelectors = platformConfig.aiTurn;
  
  // We need to interleave them based on DOM order.
  // One way is to select a common ancestor or just select all elements matching either selector and sort by position.
  // A simpler way for Claude is selecting all turn elements and checking their dataset.
  const allTurnSelector = [...humanTurnSelectors, ...aiTurnSelectors].join(', ');
  const elements = document.querySelectorAll(allTurnSelector);
  
  for (const el of elements) {
    let role = 'assistant';
    for (const humanSel of humanTurnSelectors) {
      if (el.matches(humanSel)) {
        role = 'user';
        break;
      }
    }
    
    turns.push({
      role,
      content: el.innerText.trim()
    });
  }
  
  return turns;
}

export async function injectText(text) {
  await init();
  const inputEl = resolveElement(platformConfig, 'input');
  
  // Focus the element
  inputEl.focus();
  
  // Claude uses ProseMirror which requires document.execCommand for correct React state updates
  // Alternatively, we can clear and insert
  inputEl.innerText = '';
  document.execCommand('insertText', false, text);
  
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function submitInput() {
  await init();
  
  // Give React a moment to enable the send button
  await new Promise(resolve => setTimeout(resolve, 200));
  
  try {
    const submitBtn = resolveElement(platformConfig, 'submit');
    submitBtn.removeAttribute('disabled');
    submitBtn.click();
  } catch (e) {
    const inputEl = resolveElement(platformConfig, 'input');
    inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true
    }));
  }
}

export async function waitForResponse(timeoutMs = 30000) {
  await init();
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => {
      observer.disconnect();
      reject(new Error('[MemoryBridge] Timeout waiting for AI response'));
    }, timeoutMs);

    let stabilityTimeout;
    
    // Watch for new AI turns appearing
    const observer = new MutationObserver(() => {
      // Find the last AI turn
      const aiTurns = resolveElements(platformConfig, 'aiTurn');
      if (aiTurns.length === 0) return;
      
      const lastTurn = aiTurns[aiTurns.length - 1];
      const text = lastTurn.innerText.trim();
      
      // If it's empty, it just started generating
      if (!text) return;

      // Reset stability timer whenever DOM changes
      clearTimeout(stabilityTimeout);
      stabilityTimeout = setTimeout(() => {
        observer.disconnect();
        clearTimeout(timeout);
        resolve(text);
      }, 2000); // 2 seconds of no DOM changes means it's done
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  });
}

export async function cleanupLastExchange() {
  await init();
  const humanTurns = resolveElements(platformConfig, 'humanTurn');
  const aiTurns = resolveElements(platformConfig, 'aiTurn');
  
  if (humanTurns.length > 0) {
    const lastHuman = humanTurns[humanTurns.length - 1];
    lastHuman.style.display = 'none';
    lastHuman.dataset.mbHidden = 'true';
  }
  
  if (aiTurns.length > 0) {
    const lastAI = aiTurns[aiTurns.length - 1];
    lastAI.style.display = 'none';
    lastAI.dataset.mbHidden = 'true';
  }
}
