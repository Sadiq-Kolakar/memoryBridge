/**
 * MemoryBridge Summarizer — 100% Local, Zero Disruption
 * 
 * Generates structured memory notes entirely in the background
 * using local text analysis. Never touches the user's chat.
 */

export function summarize(platform, conversationArray) {
  // Extract a meaningful title from the first user message
  const firstUserMsg = conversationArray.find(t => t.role === 'user')?.content || 'Untitled Conversation';
  const title = firstUserMsg.substring(0, 80).replace(/[\n\r]+/g, ' ').trim();

  // Build a concise summary from the conversation
  const totalTurns = conversationArray.length;
  const userTurns = conversationArray.filter(t => t.role === 'user');
  const assistantTurns = conversationArray.filter(t => t.role === 'assistant');

  // Grab key excerpts
  const firstAssistantMsg = assistantTurns[0]?.content || '';
  const summaryExcerpt = firstAssistantMsg.substring(0, 400).trim();

  // Auto-detect tags from content
  const tags = autoDetectTags(conversationArray);

  // Extract any code snippets
  const codeSnippets = extractCodeSnippets(conversationArray);

  // Extract any URLs/links
  const links = extractLinks(conversationArray);

  // Build key insights from the conversation flow
  const keyInsights = buildKeyInsights(userTurns, assistantTurns);

  return {
    title: title.length > 60 ? title.substring(0, 57) + '...' : title,
    tags,
    summary: summaryExcerpt.length > 0
      ? `${totalTurns} turns (${userTurns.length} user, ${assistantTurns.length} AI). ${summaryExcerpt}${firstAssistantMsg.length > 400 ? '...' : ''}`
      : `Conversation with ${totalTurns} turns.`,
    keyInsights,
    codeSnippets,
    links
  };
}

function autoDetectTags(conversationArray) {
  const fullText = conversationArray.map(t => t.content).join(' ').toLowerCase();
  const tags = new Set();

  const tagPatterns = {
    'coding':     /\b(code|function|variable|class|import|export|async|await|const|let|var|def |return |console\.log|print\()\b/,
    'javascript': /\b(javascript|js|node\.?js|react|vue|angular|typescript|npm|webpack)\b/,
    'python':     /\b(python|pip|django|flask|pandas|numpy|pytorch|tensorflow)\b/,
    'css':        /\b(css|styling|flexbox|grid|tailwind|sass|scss|animation)\b/,
    'html':       /\b(html|dom|div|span|element|tag|attribute|href)\b/,
    'api':        /\b(api|rest|graphql|endpoint|fetch|axios|request|response|http|curl)\b/,
    'database':   /\b(database|sql|mongo|postgres|mysql|firebase|supabase|query|table)\b/,
    'devops':     /\b(docker|kubernetes|ci\/cd|deploy|aws|gcp|azure|terraform|nginx)\b/,
    'ai-ml':      /\b(machine learning|deep learning|neural|model|training|gpt|llm|prompt|embedding)\b/,
    'debugging':  /\b(error|bug|fix|debug|issue|crash|exception|stack trace|undefined|null)\b/,
    'design':     /\b(design|ui|ux|figma|layout|responsive|mobile|wireframe|prototype)\b/,
    'writing':    /\b(essay|article|blog|write|draft|summary|paragraph|outline)\b/,
    'math':       /\b(math|equation|calcul|algebra|geometry|statistic|probability|integral)\b/,
    'research':   /\b(research|study|paper|journal|hypothesis|experiment|analysis)\b/,
  };

  for (const [tag, pattern] of Object.entries(tagPatterns)) {
    if (pattern.test(fullText)) {
      tags.add(tag);
    }
  }

  // Always include the platform
  tags.add('ai-chat');

  // Cap at 5 most relevant tags
  return Array.from(tags).slice(0, 5);
}

function extractCodeSnippets(conversationArray) {
  const snippets = [];
  const codeBlockRegex = /```[\s\S]*?```/g;

  for (const turn of conversationArray) {
    if (turn.role !== 'assistant') continue;
    const matches = turn.content.match(codeBlockRegex);
    if (matches) {
      for (const match of matches.slice(0, 3)) { // Max 3 snippets
        const cleaned = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
        if (cleaned.length > 10 && cleaned.length < 2000) {
          snippets.push(cleaned);
        }
      }
    }
  }

  return snippets.slice(0, 5); // Max 5 total
}

function extractLinks(conversationArray) {
  const links = new Set();
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;

  for (const turn of conversationArray) {
    const matches = turn.content.match(urlRegex);
    if (matches) {
      matches.forEach(url => links.add(url));
    }
  }

  return Array.from(links).slice(0, 10);
}

function buildKeyInsights(userTurns, assistantTurns) {
  const insights = [];

  // Summarize what the user was asking about
  if (userTurns.length > 0) {
    const topics = userTurns.map(t => t.content.substring(0, 60).replace(/[\n\r]+/g, ' ')).slice(0, 3);
    insights.push(`User asked about: ${topics.join('; ')}`);
  }

  // Note conversation length
  if (userTurns.length + assistantTurns.length > 10) {
    insights.push(`Extended conversation with ${userTurns.length + assistantTurns.length} total exchanges.`);
  }

  // Check if code was involved
  const hasCode = assistantTurns.some(t => t.content.includes('```'));
  if (hasCode) {
    insights.push('Contains code examples or implementations.');
  }

  return insights.slice(0, 5);
}
