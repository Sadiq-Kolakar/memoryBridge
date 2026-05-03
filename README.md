# 🧠 MemoryBridge

**Local-first AI memory system — Zero subscriptions, zero cloud.**

MemoryBridge is a Chrome extension that captures your AI conversations (ChatGPT, Claude, Gemini, NotebookLM) and saves them as structured Markdown notes directly into your local Obsidian vault.

## ✨ Features

- **One-Click Capture** — Save any AI conversation with a single click
- **100% Local** — All data stays on your machine. No cloud, no tracking, no subscriptions
- **Smart Summarization** — Auto-generates titles, tags, key insights, code snippets & links
- **Obsidian Integration** — Notes appear instantly in your vault with full frontmatter
- **Deduplication** — Never save the same conversation twice
- **Multi-Platform** — Works on ChatGPT, Claude, Gemini, and NotebookLM
- **Offline Queue** — If Obsidian is closed, memories are queued and synced when it reopens

## 🚀 Quick Start

### Prerequisites
- [Obsidian](https://obsidian.md/) installed with a vault
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin enabled in Obsidian

### Installation
1. Clone this repo
2. Go to `chrome://extensions/` → Enable Developer Mode
3. Click "Load Unpacked" → Select the `MemoryBridge` folder
4. Open the extension popup → Enter your API key from Obsidian settings
5. Navigate to ChatGPT/Claude/Gemini and click **Capture Now**!

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Platform    │────▶│  Content Script   │────▶│  Background SW  │
│  (ChatGPT etc.) │     │  (DOM Extraction) │     │  (Save to Vault)│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │  Obsidian Vault │
                                                  │  (Local REST API)│
                                                  └─────────────────┘
```

## 📁 Project Structure

```
MemoryBridge/
├── manifest.json          # Chrome Extension Manifest V3
├── background.js          # Service Worker (message routing, save/search)
├── content-script.js      # Injected into AI pages (DOM reading, toast UI)
├── obsidian-client.js     # CRUD operations with Obsidian REST API
├── summarizer.js          # Local text analysis (no AI calls)
├── deduplication.js       # Hash-based duplicate prevention
├── memory-schema.js       # Markdown template builder
├── selectors.json         # Platform-specific DOM selectors
├── adapters/
│   ├── chatgpt-adapter.js # ChatGPT DOM extraction
│   ├── claude-adapter.js  # Claude DOM extraction
│   └── gemini-adapter.js  # Gemini DOM extraction
├── sidebar/               # In-page sidebar UI
├── popup/                 # Extension popup UI
├── onboarding/            # First-run setup screen
└── icons/                 # Extension icons
```

## 🔒 Privacy

- **Zero external HTTP calls** — strictly local communication only
- **No telemetry, no analytics, no tracking**
- API keys stored in `chrome.storage.local` (never leaves your machine)
- All processing happens on-device

## 📝 License

MIT License — Use it, fork it, build on it.

---

Built with ❤️ by [Sadiq Kolakar](https://github.com/Sadiq-Kolakar)
