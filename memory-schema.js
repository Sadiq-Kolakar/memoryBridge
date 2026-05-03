export function buildMarkdown(memoryNote, platform, rawConversationString, hash) {
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
    chatgpt:    { emoji: '🤖', name: 'ChatGPT',    color: '#10a37f' },
    claude:     { emoji: '🟠', name: 'Claude',      color: '#d97706' },
    gemini:     { emoji: '💎', name: 'Gemini',       color: '#4285f4' },
    notebooklm: { emoji: '📓', name: 'NotebookLM',  color: '#ea4335' }
  };
  const pm = platformMeta[platform] || { emoji: '🧠', name: platform, color: '#7c3aed' };

  // Count conversation stats
  let totalTurns = 0, userTurns = 0, aiTurns = 0, totalWords = 0;
  try {
    const convo = JSON.parse(rawConversationString);
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
version: 1
hash: ${hash}
cssclass: memorybridge-note
---

`;

  // ── HEADER ──
  md += `# ${pm.emoji} ${memoryNote.title || 'Untitled Memory'}\n\n`;

  // ── META RIBBON ──
  md += `> [!info]+ Memory Details\n`;
  md += `> **Platform:** ${pm.emoji} ${pm.name}  \n`;
  md += `> **Captured:** ${readableDate} at ${readableTime}  \n`;
  md += `> **Turns:** ${totalTurns} (${userTurns} user · ${aiTurns} AI)  \n`;
  md += `> **Words:** ~${totalWords.toLocaleString()}  \n`;
  if (memoryNote.tags && memoryNote.tags.length > 0) {
    md += `> **Tags:** ${memoryNote.tags.map(t => `\`${t}\``).join(' · ')}  \n`;
  }
  md += `\n---\n\n`;

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
      // Try to detect language from content
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
      // Extract domain for display
      let domain = '';
      try { domain = new URL(link).hostname; } catch (e) { domain = link; }
      md += `- [${domain}](${link})\n`;
    });
    md += `\n`;
  }

  // ── CONVERSATION ──
  md += `---\n\n`;
  md += `## 💬 Conversation\n\n`;

  try {
    const convo = JSON.parse(rawConversationString);
    const maxTurns = 30;
    const turns = convo.slice(0, maxTurns);
    
    turns.forEach((turn, idx) => {
      const isUser = turn.role === 'user';
      const label = isUser ? '🧑 **You**' : `${pm.emoji} **${pm.name}**`;
      const content = (turn.content || '').trim();
      
      if (!content) return;
      
      // Truncate very long AI responses
      const maxLen = isUser ? 1000 : 2000;
      const truncated = content.length > maxLen;
      const displayContent = truncated 
        ? content.substring(0, maxLen) + '\n\n*(...truncated)*'
        : content;
      
      md += `### ${label}\n\n`;
      
      if (isUser) {
        // User messages as blockquotes for visual distinction
        displayContent.split('\n').forEach(line => {
          md += `> ${line}\n`;
        });
      } else {
        // AI responses rendered directly (they may contain markdown)
        md += `${displayContent}\n`;
      }
      
      md += `\n`;
    });
    
    if (convo.length > maxTurns) {
      md += `> [!note] Truncated\n`;
      md += `> This conversation had **${convo.length}** total turns. Showing the first ${maxTurns}.\n\n`;
    }
  } catch (e) {
    const excerpt = rawConversationString.substring(0, 2000);
    md += `\`\`\`\n${excerpt}\n\`\`\`\n`;
    if (rawConversationString.length > 2000) {
      md += `\n*...truncated*\n`;
    }
  }

  // ── FOOTER ──
  md += `\n---\n\n`;
  md += `*Captured by [MemoryBridge](https://github.com/Sadiq-Kolakar/memoryBridge) · ${readableDate}*\n`;

  return md;
}

function detectCodeLanguage(snippet) {
  const patterns = {
    'javascript': /\b(const |let |var |function |=>|require\(|import |export |async |await |console\.)/,
    'python':     /\b(def |class |import |from |print\(|self\.|elif |lambda )/,
    'html':       /(<\/?[a-z]+[\s>]|<!DOCTYPE|<html|<div|<span)/i,
    'css':        /\{[\s\S]*?:\s*[\s\S]*?;[\s\S]*?\}|@media|\.[\w-]+\s*\{/,
    'sql':        /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|CREATE TABLE)\b/i,
    'json':       /^\s*[\[{]/,
    'bash':       /\b(echo |sudo |chmod |mkdir |cd |ls |grep |curl |npm |git )/,
    'typescript': /\b(interface |type |enum |readonly |as |implements )/,
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
