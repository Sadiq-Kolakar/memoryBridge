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
  
  // Build YAML tags properly quoted
  const tagsYaml = (memoryNote.tags || []).map(t => `"${t}"`).join(', ');
  
  // Platform emoji
  const platformEmoji = {
    chatgpt: '🤖', claude: '🟠', gemini: '💎', notebooklm: '📓'
  }[platform] || '🧠';

  let markdown = `---
title: "${(memoryNote.title || 'Untitled Memory').replace(/"/g, '\\"')}"
platform: ${platform}
session_id: ${sessionId}
date: ${date}
tags: [${tagsYaml}]
status: ${memoryNote.status || 'summarized'}
version: 1
hash: ${hash}
---

# ${platformEmoji} ${memoryNote.title || 'Untitled Memory'}

> **${platform.charAt(0).toUpperCase() + platform.slice(1)}** · ${readableDate} at ${readableTime}

---

## 📋 Summary
${memoryNote.summary || 'No summary available.'}

`;

  // Key Insights
  if (memoryNote.keyInsights && memoryNote.keyInsights.length > 0) {
    markdown += `## 💡 Key Insights\n`;
    memoryNote.keyInsights.forEach(i => {
      markdown += `- ${i}\n`;
    });
    markdown += '\n';
  }

  // Code Snippets
  if (memoryNote.codeSnippets && memoryNote.codeSnippets.length > 0) {
    markdown += `## 🧩 Code Snippets\n\n`;
    memoryNote.codeSnippets.forEach((c, idx) => {
      markdown += `### Snippet ${idx + 1}\n\`\`\`\n${c}\n\`\`\`\n\n`;
    });
  }

  // Links
  if (memoryNote.links && memoryNote.links.length > 0) {
    markdown += `## 🔗 Links & References\n`;
    memoryNote.links.forEach(l => {
      markdown += `- [${l}](${l})\n`;
    });
    markdown += '\n';
  }

  // Raw Conversation
  markdown += `---\n\n## 💬 Conversation Excerpt\n\n`;
  
  // Parse the raw conversation for nicer formatting
  try {
    const convo = JSON.parse(rawConversationString);
    const maxTurns = 20; // Show first 20 turns
    const turns = convo.slice(0, maxTurns);
    
    turns.forEach(turn => {
      const label = turn.role === 'user' ? '**🧑 You**' : `**${platformEmoji} AI**`;
      const content = (turn.content || '').substring(0, 500);
      markdown += `${label}:\n> ${content.split('\\n').join('\\n> ')}\n\n`;
    });
    
    if (convo.length > maxTurns) {
      markdown += `*...and ${convo.length - maxTurns} more turns.*\n`;
    }
  } catch (e) {
    // Fallback: show raw excerpt
    const excerpt = rawConversationString.substring(0, 1000);
    markdown += `> ${excerpt}\n`;
    if (rawConversationString.length > 1000) {
      markdown += '> ...\n';
    }
  }

  return markdown;
}

export function sanitizeFilename(title) {
  // Create a clean, readable filename
  return title
    .replace(/[<>:"/\\|?*]/g, '')   // Remove illegal filesystem chars
    .replace(/\s+/g, '-')            // Spaces → hyphens
    .replace(/--+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '')           // Trim leading/trailing hyphens
    .substring(0, 60)                // Cap length
    .toLowerCase();
}

export function generateFilename(title, platform) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // 2026-05-03
  const cleanTitle = sanitizeFilename(title);
  const platformTag = platform.charAt(0).toUpperCase() + platform.slice(1);
  
  // Format: "2026-05-03_ChatGPT_how-to-create-a-rest-api"
  return `${dateStr}_${platformTag}_${cleanTitle}`;
}
