export async function extractConversation() {
  // NotebookLM is read-only DOM capture per prompt
  const notes = Array.from(document.querySelectorAll('.note-item, [data-note-id]'))
    .map(el => el.innerText.trim())
    .filter(Boolean);

  const sources = Array.from(document.querySelectorAll('.source-item, [data-source-id]'))
    .map(el => ({
      role: 'user', // Treat sources as user context
      content: el.innerText.trim() || 'Untitled Source'
    }));

  const combinedTurns = [...sources];
  notes.forEach(note => combinedTurns.push({ role: 'assistant', content: note }));

  return combinedTurns;
}

export async function injectText(text) {
  throw new Error('[MemoryBridge] NotebookLM does not support input injection.');
}

export async function submitInput() {
  throw new Error('[MemoryBridge] NotebookLM does not support submit.');
}

export async function waitForResponse(timeoutMs) {
  throw new Error('[MemoryBridge] NotebookLM does not support wait for response.');
}

export async function cleanupLastExchange() {
  // No-op
}
