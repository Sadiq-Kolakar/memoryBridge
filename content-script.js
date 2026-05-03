// MemoryBridge Content Script — Zero-Disruption Capture
// Never injects text into the chat. Never sends prompts. 100% silent.

let platform = '';

function detectPlatform() {
  const hostname = window.location.hostname;
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('gemini.google.com')) return 'gemini';
  if (hostname.includes('notebooklm.google.com')) return 'notebooklm';
  return null;
}

function injectSidebar() {
  if (document.getElementById('memorybrige-root')) return;

  const container = document.createElement('div');
  container.id = 'memorybrige-root';
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    height: 100vh;
    z-index: 2147483647;
    border-left: 1px solid #2a2a2a;
    background: #0f0f0f;
    display: none;
    flex-direction: column;
    font-family: system-ui;
  `;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('sidebar/sidebar.html');
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;';
  container.appendChild(iframe);
  document.body.appendChild(container);

  const toggle = document.createElement('button');
  toggle.id = 'memorybrige-toggle';
  toggle.innerText = '🧠';
  toggle.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #7c3aed;
    border: none;
    cursor: pointer;
    font-size: 20px;
    box-shadow: 0 4px 12px rgba(124,58,237,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  toggle.onclick = () => {
    const isVisible = container.style.display === 'flex';
    container.style.display = isVisible ? 'none' : 'flex';
  };
  document.body.appendChild(toggle);
}

function injectStatusPill() {
  if (document.getElementById('memorybridge-status')) return;
  const pill = document.createElement('div');
  pill.id = 'memorybridge-status';
  pill.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    z-index: 99998;
    background: #1a1a1a;
    color: #e5e5e5;
    padding: 6px 12px;
    border-radius: 16px;
    font-family: system-ui;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #2a2a2a;
    cursor: help;
  `;
  pill.innerHTML = `<span id="mb-status-dot" style="width:8px;height:8px;border-radius:50%;background:grey;"></span> 🧠 MemoryBridge`;
  document.body.appendChild(pill);
  
  updateStatusPill();
  setInterval(updateStatusPill, 60000);
}

function updateStatusPill() {
  chrome.runtime.sendMessage({ type: 'CHECK_VAULT' }, (res) => {
    const dot = document.getElementById('mb-status-dot');
    if (dot) {
      if (res && res.status === 'online') dot.style.background = '#10b981';
      else dot.style.background = '#ef4444';
    }
  });
}

function showToast(message, type = 'success') {
  const existing = document.getElementById('mb-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'mb-toast';
  const bgColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b';
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 24px;
    z-index: 2147483647;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-family: system-ui;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 0;
    transform: translateY(10px);
  `;
  toast.innerText = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function captureConversation() {
  console.log('[MemoryBridge] Capturing conversation...');
  showToast('🧠 Capturing...', 'info');

  try {
    const adapterModule = await import(chrome.runtime.getURL(`adapters/${platform}-adapter.js`));
    const conversationArray = await adapterModule.extractConversation();
    
    if (conversationArray.length === 0) {
      showToast('❌ No conversation found on this page.', 'error');
      return;
    }

    const summarizerModule = await import(chrome.runtime.getURL('summarizer.js'));
    const memoryNote = await summarizerModule.summarize(platform, conversationArray);

    chrome.runtime.sendMessage({
      type: 'SAVE_MEMORY',
      payload: { memoryNote, platform, rawConversationArray: conversationArray }
    }, (res) => {
      if (res && res.success) {
        if (res.status === 'saved') showToast(`✅ Saved: "${memoryNote.title}"`, 'success');
        else if (res.status === 'queued') showToast('📦 Queued — Obsidian offline.', 'info');
        else if (res.status === 'duplicate') showToast('⚡ Already saved — skipped.', 'info');
      } else {
        showToast('❌ Failed to save memory.', 'error');
      }
      updateStatusPill();
    });
  } catch (error) {
    console.error('[MemoryBridge] Capture failed:', error);
    showToast(`❌ Capture failed: ${error.message}`, 'error');
  }
}

function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'CAPTURE_NOW') {
      captureConversation().then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
    
    if (msg.type === 'INJECT_CONTEXT') {
      (async () => {
        const adapterModule = await import(chrome.runtime.getURL(`adapters/${platform}-adapter.js`));
        await adapterModule.injectText(msg.payload);
        sendResponse({ success: true });
      })();
      return true;
    }
  });

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'MB_CLOSE_SIDEBAR') {
      const container = document.getElementById('memorybrige-root');
      if (container) container.style.display = 'none';
    }
  });
}

function init() {
  platform = detectPlatform();
  if (!platform) return;

  console.log(`[MemoryBridge] Initialized for platform: ${platform}`);
  window.__MB_DEBUG__ = { platform, captureConversation };

  injectSidebar();
  injectStatusPill();
  setupMessageListeners();
}

init();
