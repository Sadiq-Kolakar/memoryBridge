export function buildMarkdown(memoryNote, platform, rawConversationString, hash) {
  const date = new Date().toISOString();
  const sessionId = `mb_${Date.now()}`;
  
  const tagsStr = (memoryNote.tags || []).map(t => `[${t}]`).join(', ');
  
  let markdown = `---
title: ${memoryNote.title || 'Untitled Memory'}
platform: ${platform}
session_id: ${sessionId}
timestamp: ${date}
tags: [${(memoryNote.tags || []).join(', ')}]
status: ${memoryNote.status || 'summarized'}
version: 1
hash: ${hash}
---

## Summary
${memoryNote.summary || ''}

## Key Decisions / Insights
${(memoryNote.keyInsights || []).map(i => `- ${i}`).join('\n')}

## Code Snippets
${(memoryNote.codeSnippets || []).map(c => `\`\`\`\n${c}\n\`\`\``).join('\n\n')}

## Links / References
${(memoryNote.links || []).map(l => `- ${l}`).join('\n')}

## Raw Conversation Excerpt
`;

  // Provide a short excerpt of the raw conversation, e.g. first 1000 chars
  const excerpt = rawConversationString.substring(0, 1000);
  const excerptLines = excerpt.split('\n').map(l => `> ${l}`).join('\n');
  markdown += excerptLines;
  if (rawConversationString.length > 1000) {
    markdown += '\n> ...';
  }

  return markdown;
}

export function sanitizeFilename(title) {
  return title.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 50);
}
