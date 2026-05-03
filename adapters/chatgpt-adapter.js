import { getSelectors, resolveElement, resolveElements } from '../utils/resolver.js';

let platformConfig = null;

async function init() {
  if (!platformConfig) {
    platformConfig = await getSelectors('chatgpt');
  }
}

export async function extractConversation() {
  await init();
  const turns = [];
  
  const elements = resolveElements(platformConfig, 'messageContainer');
  for (const el of elements) {
    const role = el.dataset.messageAuthorRole || 'unknown';
    const contentEl = el.querySelector('.markdown, .whitespace-pre-wrap');
    if (contentEl) {
      turns.push({ role, content: contentEl.innerText.trim() });
    }
  }
  return turns;
}

export async function injectText(text) {
  await init();
  const inputEl = resolveElement(platformConfig, 'input');
  inputEl.focus();
  
  if (inputEl.tagName.toUpperCase() === 'TEXTAREA') {
    // For React textareas, we must use the native property setter to bypass React's event pooling/overrides
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    nativeInputValueSetter.call(inputEl, text);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    inputEl.innerText = '';
    document.execCommand('insertText', false, text);
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export async function submitInput() {
  await init();
  
  // Give React a moment to enable the send button after the input events
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Try to find the send button and click it
  try {
    const submitBtn = resolveElement(platformConfig, 'submit');
    submitBtn.removeAttribute('disabled');
    submitBtn.click();
  } catch (e) {
    // Fallback: Dispatch Enter key on the input element
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
    
    const observer = new MutationObserver(() => {
      const messages = resolveElements(platformConfig, 'messageContainer');
      if (messages.length === 0) return;
      
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.dataset.messageAuthorRole !== 'assistant') return;
      
      const contentEl = lastMsg.querySelector('.markdown, .whitespace-pre-wrap');
      if (!contentEl) return;
      
      const text = contentEl.innerText.trim();
      if (!text) return;

      clearTimeout(stabilityTimeout);
      stabilityTimeout = setTimeout(() => {
        // Check if generation finished (ChatGPT removes generating class or adds specific button, but stability works)
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
  const messages = resolveElements(platformConfig, 'messageContainer');
  if (messages.length >= 2) {
    const lastAI = messages[messages.length - 1];
    const lastUser = messages[messages.length - 2];
    
    if (lastUser) {
      lastUser.style.display = 'none';
      lastUser.dataset.mbHidden = 'true';
    }
    if (lastAI) {
      lastAI.style.display = 'none';
      lastAI.dataset.mbHidden = 'true';
    }
  }
}
