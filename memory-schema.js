/**
 * MemoryBridge — Memory Schema & Markdown Builder
 * 
 * Generates beautiful, Obsidian-native markdown notes with:
 * - Full conversation history (zero truncation)
 * - [[wikilinks]] to related memories
 * - Collapsible callouts for metadata, code, and conversation
 * - Auto-detected code languages
 * - Obsidian graph-friendly tags and links
 */

export function buildMarkdown(memoryNote, platform, rawConversationString, hash, relatedNotes = []) {
  const now = new Date();
  const date = now.toISOString();
  const readableDate = now.toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  const readableTime = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit' 
  });
  const sessionId = `mb_${Date.now()}`;
  
  const tagsYaml = (memoryNote.tags || []).map(t => `"${t}"`).join(', ');
  
  const platformMeta = {
    chatgpt:    { emoji: '🤖', name: 'ChatGPT' },
    claude:     { emoji: '🟠', name: 'Claude' },
    gemini:     { emoji: '💎', name: 'Gemini' },
    notebooklm: { emoji: '📓', name: 'NotebookLM' }
  };
  const pm = platformMeta[platform] || { emoji: '🧠', name: platform };

  // ── Parse conversation stats ──
  let convo = [];
  let totalTurns = 0, userTurns = 0, aiTurns = 0, totalWords = 0;
  try {
    convo = JSON.parse(rawConversationString);
    totalTurns = convo.length;
    userTurns = convo.filter(t => t.role === 'user').length;
    aiTurns = convo.filter(t => t.role === 'assistant').length;
    totalWords = convo.reduce((sum, t) => sum + (t.content || '').split(/\s+/).length, 0);
  } catch (e) {}

  // ── FRONTMATTER ──
  let md = `---
title: "${(memoryNote.title || 'Untitled Memory').replace(/"/g, '\\"')}"
platform: ${platform}
session_id: ${sessionId}
date: ${date}
tags: [${tagsYaml}]
status: ${memoryNote.status || 'summarized'}
turns: ${totalTurns}
words: ${totalWords}
related: [${relatedNotes.map(n => `"[[${n}]]"`).join(', ')}]
version: 2
hash: ${hash}
cssclass: memorybridge-note
---

`;

  // ── HEADER ──
  md += `# ${pm.emoji} ${memoryNote.title || 'Untitled Memory'}\n\n`;

  // ── META CALLOUT ──
  md += `> [!info]+ 📊 Memory Details\n`;
  md += `> | | |\n`;
  md += `> |---|---|\n`;
  md += `> | **Platform** | ${pm.emoji} ${pm.name} |\n`;
  md += `> | **Captured** | ${readableDate} at ${readableTime} |\n`;
  md += `> | **Turns** | ${totalTurns} (${userTurns} user · ${aiTurns} AI) |\n`;
  md += `> | **Words** | ~${totalWords.toLocaleString()} |\n`;
  if (memoryNote.tags && memoryNote.tags.length > 0) {
    md += `> | **Tags** | ${memoryNote.tags.map(t => `#${t}`).join(' ')} |\n`;
  }
  md += `\n`;

  // ── RELATED MEMORIES (Wikilinks) ──
  if (relatedNotes.length > 0) {
    md += `> [!tip]+ 🔗 Related Memories\n`;
    relatedNotes.forEach(note => {
      md += `> - [[${note}]]\n`;
    });
    md += `\n`;
  }

  md += `---\n\n`;

  // ── SUMMARY ──
  md += `## 📋 Summary\n\n`;
  md += `${memoryNote.summary || 'No summary available.'}\n\n`;

  // ── KEY INSIGHTS ──
  if (memoryNote.keyInsights && memoryNote.keyInsights.length > 0) {
    md += `## 💡 Key Insights\n\n`;
    memoryNote.keyInsights.forEach(insight => {
      md += `- ${insight}\n`;
    });
    md += `\n`;
  }

  // ── CODE SNIPPETS ──
  if (memoryNote.codeSnippets && memoryNote.codeSnippets.length > 0) {
    md += `## 🧩 Code Snippets\n\n`;
    memoryNote.codeSnippets.forEach((snippet, idx) => {
      const lang = detectCodeLanguage(snippet);
      md += `> [!example]- Snippet ${idx + 1}\n`;
      md += `> \`\`\`${lang}\n`;
      snippet.split('\n').forEach(line => {
        md += `> ${line}\n`;
      });
      md += `> \`\`\`\n\n`;
    });
  }

  // ── LINKS ──
  if (memoryNote.links && memoryNote.links.length > 0) {
    md += `## 🔗 Links & References\n\n`;
    memoryNote.links.forEach(link => {
      let domain = '';
      try { domain = new URL(link).hostname; } catch (e) { domain = link; }
      md += `- [${domain}](${link})\n`;
    });
    md += `\n`;
  }

  // ── FULL CONVERSATION ──
  md += `---\n\n`;
  md += `## 💬 Full Conversation\n\n`;

  if (convo.length > 0) {
    convo.forEach((turn, idx) => {
      const isUser = turn.role === 'user';
      const label = isUser ? '🧑 **You**' : `${pm.emoji} **${pm.name}**`;
      const content = (turn.content || '').trim();
      
      if (!content) return;
      
      md += `### ${label}\n\n`;
      
      if (isUser) {
        content.split('\n').forEach(line => {
          md += `> ${line}\n`;
        });
      } else {
        md += `${content}\n`;
      }
      
      md += `\n`;
    });
  } else {
    // Fallback for unparseable conversations
    md += `\`\`\`\n${rawConversationString}\n\`\`\`\n`;
  }

  // ── FOOTER ──
  md += `\n---\n\n`;
  md += `> *Captured by [MemoryBridge](https://github.com/Sadiq-Kolakar/memoryBridge) · ${readableDate}*\n`;

  return md;
}

function detectCodeLanguage(snippet) {
  const patterns = {
    'javascript': /\b(const |let |var |function |=>|require\(|import |export |async |await |console\.)/,
    'python':     /\b(def |class |import |from |print\(|self\.|elif |lambda )/,
    'html':       /((<\/?[a-z]+[\s>])|<!DOCTYPE|<html|<div|<span)/i,
    'css':        /\{[\s\S]*?:\s*[\s\S]*?;[\s\S]*?\}|@media|\.[\\w-]+\s*\{/,
    'sql':        /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|CREATE TABLE)\b/i,
    'json':       /^\s*[\[{]/,
    'bash':       /\b(echo |sudo |chmod |mkdir |cd |ls |grep |curl |npm |git )/,
    'typescript': /\b(interface |type |enum |readonly |as |implements )/,
    'java':       /\b(public |private |protected |class |void |static |throws )/,
    'rust':       /\b(fn |let mut |impl |struct |enum |pub |use |mod )/,
  };

  for (const [lang, regex] of Object.entries(patterns)) {
    if (regex.test(snippet)) return lang;
  }
  return '';
}

export function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)
    .toLowerCase();
}

export function generateFilename(title, platform) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const cleanTitle = sanitizeFilename(title);
  const platformTag = platform.charAt(0).toUpperCase() + platform.slice(1);
  
  return `${dateStr}_${platformTag}_${cleanTitle}`;
}
