const state = {
  memories: [],
  filteredMemories: [],
  tags: new Set(),
  activeTags: new Set(),
  searchQuery: ''
};

const dom = {
  searchInput: document.getElementById('search-input'),
  tagsContainer: document.getElementById('tags-container'),
  memoryList: document.getElementById('memory-list'),
  captureBtn: document.getElementById('capture-btn'),
  closeBtn: document.getElementById('close-btn')
};

async function init() {
  setupEventListeners();
  await checkVaultStatus();
  await fetchMemories();
}

function setupEventListeners() {
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    applyFilters();
  });

  dom.captureBtn.addEventListener('click', () => {
    // Send message to background or content script to capture
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_NOW' }, (response) => {
        if (chrome.runtime.lastError) {
          alert('MemoryBridge: Please open a ChatGPT, Claude, Gemini, or NotebookLM tab to capture a conversation!');
        } else {
          window.parent.postMessage({ type: 'MB_CLOSE_SIDEBAR' }, '*');
        }
      });
    });
  });

  dom.closeBtn.addEventListener('click', () => {
    // We are inside an iframe. Post message to parent to close.
    window.parent.postMessage({ type: 'MB_CLOSE_SIDEBAR' }, '*');
  });
}

async function checkVaultStatus() {
  chrome.runtime.sendMessage({ type: 'CHECK_VAULT' }, (response) => {
    if (response && response.status === 'online') {
      // Show online status somewhere if needed
    } else {
      dom.memoryList.innerHTML = `<div style="padding: 16px; color: var(--mb-muted)">Vault offline. ${response && response.error ? response.error : 'Please check Obsidian.'}</div>`;
    }
  });
}

async function fetchMemories() {
  chrome.runtime.sendMessage({ type: 'FETCH_ALL_MEMORIES' }, async (response) => {
    if (response && response.success && response.data.files) {
      // In a real app we'd fetch the content of each or rely on search endpoint.
      // Since listNotes only gives filenames, we might use searchNotes('') to get metadata
      // For MVP, we will use SEARCH_MEMORY with empty query to get parsed data if the plugin supports it,
      // or we just show filenames. Let's try SEARCH_MEMORY.
      fetchDetailedMemories();
    }
  });
}

async function fetchDetailedMemories() {
  // Using search to get snippets and scores, but actually Obsidian Local REST API search returns:
  // [ { filename, score, matches: [ { context, match } ] } ]
  chrome.runtime.sendMessage({ type: 'SEARCH_MEMORY', query: 'platform:' }, (response) => {
    if (response && response.success) {
      // Parse Obsidian's search response.
      // Actually we need the frontmatter. For the sake of the wireframe, we mock parsing or just display filenames.
      const rawMemories = response.data || [];
      state.memories = rawMemories.map(m => ({
        filename: m.filename,
        title: m.filename.replace('.md', '').split('_').slice(1).join('_') || m.filename,
        tags: ['AI'], // Mock tags for now since full parse needs readNote
        date: 'Recently',
        excerpt: m.matches ? m.matches.map(x => x.context).join('...') : ''
      }));
      state.filteredMemories = [...state.memories];
      extractTags();
      renderTags();
      renderMemories();
    }
  });
}

function extractTags() {
  state.tags.clear();
  state.memories.forEach(m => m.tags.forEach(t => state.tags.add(t)));
}

function renderTags() {
  dom.tagsContainer.innerHTML = '';
  state.tags.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = `tag-chip ${state.activeTags.has(tag) ? 'active' : ''}`;
    chip.innerText = tag;
    chip.onclick = () => {
      if (state.activeTags.has(tag)) state.activeTags.delete(tag);
      else state.activeTags.add(tag);
      renderTags();
      applyFilters();
    };
    dom.tagsContainer.appendChild(chip);
  });
}

function applyFilters() {
  state.filteredMemories = state.memories.filter(m => {
    const matchesSearch = m.title.toLowerCase().includes(state.searchQuery) || m.excerpt.toLowerCase().includes(state.searchQuery);
    const matchesTags = state.activeTags.size === 0 || m.tags.some(t => state.activeTags.has(t));
    return matchesSearch && matchesTags;
  });
  renderMemories();
}

function renderMemories() {
  dom.memoryList.innerHTML = '';
  state.filteredMemories.forEach(m => {
    const card = document.createElement('div');
    card.className = 'memory-card';
    card.innerHTML = `
      <div class="memory-card-header">
        <h4 class="memory-title">${m.title}</h4>
      </div>
      <div class="memory-meta">${m.date}</div>
      <div class="memory-excerpt">${m.excerpt}</div>
      <div class="memory-footer">
        <div class="memory-tags">
          ${m.tags.map(t => `<span class="memory-tag">[${t}]</span>`).join('')}
        </div>
        <button class="inject-btn" data-file="${m.filename}">Inject ↑</button>
      </div>
    `;
    dom.memoryList.appendChild(card);
  });

  // Attach inject listeners
  document.querySelectorAll('.inject-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const filename = e.target.getAttribute('data-file');
      // To inject, we need the full text. We can read it first.
      const noteContent = await readNoteContent(filename);
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'INJECT_CONTEXT', payload: noteContent });
      });
    });
  });
}

async function readNoteContent(filename) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'READ_NOTE', filename }, (response) => {
      if (response && response.success) resolve(response.data);
      else resolve(`Failed to load ${filename}`);
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
