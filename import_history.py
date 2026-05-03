"""
MemoryBridge Bulk Importer
==========================
Imports full chat history from AI platform data exports into your Obsidian vault.

Supported Platforms:
  - ChatGPT  (conversations.json from Settings > Data Controls > Export)
  - Claude   (conversations.json from Settings > Export Data)
  - Gemini   (Takeout JSON from takeout.google.com)

Usage:
  python import_history.py --platform chatgpt --file conversations.json
  python import_history.py --platform claude  --file conversations.json
  python import_history.py --platform gemini  --folder Takeout/Gemini/

How to export your data:
  ChatGPT: Settings > Data Controls > Export Data > Download ZIP > extract conversations.json
  Claude:  Settings > Account > Export Data > Download > extract conversations.json
  Gemini:  Go to takeout.google.com > Select "Gemini Apps" > Export > Download
"""

import json
import os
import sys
import re
import hashlib
import argparse
import requests
from datetime import datetime
from pathlib import Path

# ── Config ──
OBSIDIAN_API = "http://127.0.0.1:27123"
API_KEY = ""  # Will be loaded from env or arg
VAULT_FOLDER = "MemoryBridge"

PLATFORM_META = {
    "chatgpt":    {"emoji": "🤖", "name": "ChatGPT"},
    "claude":     {"emoji": "🟠", "name": "Claude"},
    "gemini":     {"emoji": "💎", "name": "Gemini"},
}


def load_api_key():
    """Load API key from environment or config."""
    global API_KEY
    # Try env var first
    API_KEY = os.environ.get("OBSIDIAN_API_KEY", "")
    if not API_KEY:
        # Try reading from a local config file
        config_path = Path(__file__).parent / ".obsidian_api_key"
        if config_path.exists():
            API_KEY = config_path.read_text().strip()
    if not API_KEY:
        print("[ERROR] No API key found.")
        print("  Set OBSIDIAN_API_KEY env variable, or create .obsidian_api_key file")
        print("  Or pass --api-key YOUR_KEY")
        sys.exit(1)


def save_to_obsidian(filename, markdown):
    """Save a note to Obsidian vault via REST API."""
    path = f"{VAULT_FOLDER}/{filename}.md"
    url = f"{OBSIDIAN_API}/vault/{requests.utils.quote(path, safe='')}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "text/markdown"
    }
    try:
        resp = requests.put(url, headers=headers, data=markdown.encode('utf-8'))
        return resp.status_code in (200, 201, 204)
    except Exception as e:
        print(f"  [WARN] API save failed: {e}")
        return False


def save_to_file(output_dir, filename, markdown):
    """Save a note directly to filesystem as fallback."""
    filepath = output_dir / f"{filename}.md"
    filepath.write_text(markdown, encoding='utf-8')
    return True


def sanitize_filename(title):
    """Create a clean, readable filename."""
    clean = re.sub(r'[<>:"/\\|?*]', '', title)
    clean = re.sub(r'\s+', '-', clean)
    clean = re.sub(r'-{2,}', '-', clean)
    clean = clean.strip('-')[:60].lower()
    return clean or 'untitled'


def generate_filename(title, platform, date_str):
    """Generate a filename like: 2026-05-03_ChatGPT_building-a-rest-api."""
    clean_title = sanitize_filename(title)
    platform_tag = platform.capitalize()
    return f"{date_str}_{platform_tag}_{clean_title}"


def detect_code_language(snippet):
    """Auto-detect code language from content."""
    patterns = {
        'javascript': r'\b(const |let |var |function |=>|require\(|import |export )',
        'python':     r'\b(def |class |import |from |print\(|self\.)',
        'html':       r'(</?[a-z]+[\s>]|<!DOCTYPE)',
        'css':        r'\{[\s\S]*?:[\s\S]*?;[\s\S]*?\}|@media',
        'sql':        r'\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b',
        'bash':       r'\b(echo |sudo |chmod |mkdir |npm |git )',
        'java':       r'\b(public |private |class |void |static )',
    }
    for lang, pattern in patterns.items():
        if re.search(pattern, snippet, re.IGNORECASE):
            return lang
    return ''


def auto_detect_tags(full_text):
    """Auto-detect topic tags from conversation text."""
    text = full_text.lower()
    tags = set()
    tag_patterns = {
        'coding':     r'\b(code|function|variable|class|import|export|async|const|let)',
        'javascript': r'\b(javascript|js|node\.?js|react|vue|angular|typescript|npm)',
        'python':     r'\b(python|pip|django|flask|pandas|numpy)',
        'css':        r'\b(css|styling|flexbox|grid|tailwind|sass)',
        'html':       r'\b(html|dom|div|span|element|tag)',
        'api':        r'\b(api|rest|graphql|endpoint|fetch|axios|http)',
        'database':   r'\b(database|sql|mongo|postgres|mysql|firebase)',
        'ai-ml':      r'\b(machine learning|deep learning|neural|model|training|gpt|llm)',
        'debugging':  r'\b(error|bug|fix|debug|issue|crash|exception)',
        'design':     r'\b(design|ui|ux|figma|layout|responsive)',
        'writing':    r'\b(essay|article|blog|write|draft|summary)',
        'math':       r'\b(math|equation|calcul|algebra|geometry|statistic)',
    }
    for tag, pattern in tag_patterns.items():
        if re.search(pattern, text):
            tags.add(tag)
    tags.add('ai-chat')
    return list(tags)[:5]


def extract_code_snippets(text):
    """Extract code blocks from text."""
    snippets = []
    matches = re.findall(r'```[\w]*\n([\s\S]*?)```', text)
    for m in matches[:5]:
        if len(m.strip()) > 10:
            snippets.append(m.strip())
    return snippets


def extract_links(text):
    """Extract URLs from text."""
    urls = re.findall(r'https?://[^\s<>"{}|\\^`\[\]]+', text)
    return list(set(urls))[:10]


def build_markdown(title, platform, turns, date_obj, convo_hash):
    """Build the full markdown note."""
    pm = PLATFORM_META.get(platform, {"emoji": "🧠", "name": platform})
    
    readable_date = date_obj.strftime("%A, %B %d, %Y")
    readable_time = date_obj.strftime("%I:%M %p")
    iso_date = date_obj.isoformat()
    
    user_turns = [t for t in turns if t['role'] == 'user']
    ai_turns = [t for t in turns if t['role'] == 'assistant']
    total_words = sum(len((t.get('content') or '').split()) for t in turns)
    
    full_text = ' '.join(t.get('content', '') for t in turns)
    tags = auto_detect_tags(full_text)
    code_snippets = extract_code_snippets(full_text)
    links = extract_links(full_text)
    
    tags_yaml = ', '.join(f'"{t}"' for t in tags)
    
    # Summary
    first_ai = next((t['content'] for t in ai_turns if t.get('content')), '')
    summary_excerpt = first_ai[:400].strip()
    summary = f"{len(turns)} turns ({len(user_turns)} user, {len(ai_turns)} AI). {summary_excerpt}"
    if len(first_ai) > 400:
        summary += "..."
    
    # Key insights
    insights = []
    if user_turns:
        topics = [t['content'][:60].replace('\n', ' ') for t in user_turns[:3]]
        insights.append(f"User asked about: {'; '.join(topics)}")
    if len(turns) > 10:
        insights.append(f"Extended conversation with {len(turns)} total exchanges.")
    if code_snippets:
        insights.append("Contains code examples or implementations.")
    
    tags_str = ' '.join('#' + t for t in tags)
    escaped_title = title.replace('"', '\\"')
    md = f"""---
title: "{escaped_title}"
platform: {platform}
session_id: mb_import_{int(date_obj.timestamp() * 1000)}
date: {iso_date}
tags: [{tags_yaml}]
status: imported
turns: {len(turns)}
words: {total_words}
version: 2
hash: {convo_hash}
cssclass: memorybridge-note
---

# {pm['emoji']} {title}

> [!info]+ 📊 Memory Details
> | | |
> |---|---|
> | **Platform** | {pm['emoji']} {pm['name']} |
> | **Date** | {readable_date} at {readable_time} |
> | **Turns** | {len(turns)} ({len(user_turns)} user · {len(ai_turns)} AI) |
> | **Words** | ~{total_words:,} |
> | **Tags** | {tags_str} |
> | **Source** | Imported from data export |

---

## 📋 Summary

{summary}

"""
    
    if insights:
        md += "## 💡 Key Insights\n\n"
        for i in insights:
            md += f"- {i}\n"
        md += "\n"
    
    if code_snippets:
        md += "## 🧩 Code Snippets\n\n"
        for idx, snippet in enumerate(code_snippets):
            lang = detect_code_language(snippet)
            md += f"> [!example]- Snippet {idx + 1}\n"
            md += f"> ```{lang}\n"
            for line in snippet.split('\n'):
                md += f"> {line}\n"
            md += "> ```\n\n"
    
    if links:
        md += "## 🔗 Links & References\n\n"
        for link in links:
            try:
                from urllib.parse import urlparse
                domain = urlparse(link).hostname
            except:
                domain = link
            md += f"- [{domain}]({link})\n"
        md += "\n"
    
    # Full conversation
    md += "---\n\n## 💬 Full Conversation\n\n"
    
    for turn in turns:
        content = (turn.get('content') or '').strip()
        if not content:
            continue
        
        is_user = turn['role'] == 'user'
        label = '🧑 **You**' if is_user else f"{pm['emoji']} **{pm['name']}**"
        md += f"### {label}\n\n"
        
        if is_user:
            for line in content.split('\n'):
                md += f"> {line}\n"
        else:
            md += f"{content}\n"
        md += "\n"
    
    md += f"\n---\n\n> *Imported by [MemoryBridge](https://github.com/Sadiq-Kolakar/memoryBridge) · {readable_date}*\n"
    
    return md


# ══════════════════════════════════════════════
# PLATFORM PARSERS
# ══════════════════════════════════════════════

def parse_chatgpt(filepath):
    """Parse ChatGPT's conversations.json export."""
    print(f"[ChatGPT] Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    conversations = []
    for convo in data:
        title = convo.get('title', 'Untitled')
        create_time = convo.get('create_time', 0)
        date_obj = datetime.fromtimestamp(create_time) if create_time else datetime.now()
        
        turns = []
        mapping = convo.get('mapping', {})
        
        # ChatGPT stores messages in a tree structure via mapping
        # We need to walk the tree in order
        sorted_nodes = sorted(
            mapping.values(),
            key=lambda n: n.get('message', {}).get('create_time', 0) or 0
        )
        
        for node in sorted_nodes:
            msg = node.get('message')
            if not msg:
                continue
            role = msg.get('author', {}).get('role', '')
            if role not in ('user', 'assistant'):
                continue
            
            parts = msg.get('content', {}).get('parts', [])
            content = '\n'.join(str(p) for p in parts if isinstance(p, str))
            
            if content.strip():
                turns.append({'role': role, 'content': content.strip()})
        
        if turns:
            conversations.append({
                'title': title,
                'turns': turns,
                'date': date_obj
            })
    
    print(f"[ChatGPT] Found {len(conversations)} conversations")
    return conversations


def parse_claude(filepath):
    """Parse Claude's data export."""
    print(f"[Claude] Loading {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    conversations = []
    
    # Claude export can be a list of conversations
    items = data if isinstance(data, list) else data.get('conversations', data.get('chats', []))
    
    for convo in items:
        title = convo.get('name', convo.get('title', 'Untitled'))
        created = convo.get('created_at', convo.get('createdAt', ''))
        
        try:
            date_obj = datetime.fromisoformat(created.replace('Z', '+00:00'))
        except:
            date_obj = datetime.now()
        
        turns = []
        messages = convo.get('chat_messages', convo.get('messages', []))
        
        for msg in messages:
            role = msg.get('sender', msg.get('role', ''))
            if role == 'human':
                role = 'user'
            elif role == 'assistant':
                role = 'assistant'
            else:
                continue
            
            content = msg.get('text', msg.get('content', ''))
            if isinstance(content, list):
                content = '\n'.join(
                    p.get('text', str(p)) for p in content 
                    if isinstance(p, dict) and p.get('type') == 'text'
                )
            
            if content and content.strip():
                turns.append({'role': role, 'content': content.strip()})
        
        if turns:
            conversations.append({
                'title': title,
                'turns': turns,
                'date': date_obj
            })
    
    print(f"[Claude] Found {len(conversations)} conversations")
    return conversations


def parse_gemini(folder_path):
    """Parse Google Takeout Gemini export (folder of JSON files)."""
    print(f"[Gemini] Scanning {folder_path}...")
    folder = Path(folder_path)
    conversations = []
    
    json_files = list(folder.rglob('*.json'))
    print(f"[Gemini] Found {len(json_files)} JSON files")
    
    for jf in json_files:
        try:
            with open(jf, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except:
            continue
        
        # Gemini Takeout stores each conversation as a separate file
        items = data if isinstance(data, list) else [data]
        
        for convo in items:
            title = convo.get('title', jf.stem)
            created = convo.get('createTime', convo.get('create_time', ''))
            
            try:
                date_obj = datetime.fromisoformat(created.replace('Z', '+00:00'))
            except:
                date_obj = datetime.now()
            
            turns = []
            messages = convo.get('messages', convo.get('entries', []))
            
            for msg in messages:
                role = msg.get('role', msg.get('author', ''))
                if role in ('user', 'USER', '0'):
                    role = 'user'
                elif role in ('model', 'MODEL', 'assistant', '1'):
                    role = 'assistant'
                else:
                    continue
                
                parts = msg.get('parts', msg.get('content', []))
                if isinstance(parts, str):
                    content = parts
                elif isinstance(parts, list):
                    content = '\n'.join(
                        p.get('text', str(p)) if isinstance(p, dict) else str(p) 
                        for p in parts
                    )
                else:
                    content = str(parts)
                
                if content and content.strip():
                    turns.append({'role': role, 'content': content.strip()})
            
            if turns:
                conversations.append({
                    'title': title,
                    'turns': turns,
                    'date': date_obj
                })
    
    print(f"[Gemini] Found {len(conversations)} conversations")
    return conversations


# ══════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="MemoryBridge Bulk Importer - Import AI chat history into Obsidian"
    )
    parser.add_argument('--platform', required=True, choices=['chatgpt', 'claude', 'gemini'],
                        help='AI platform to import from')
    parser.add_argument('--file', help='Path to conversations.json (ChatGPT/Claude)')
    parser.add_argument('--folder', help='Path to Takeout folder (Gemini)')
    parser.add_argument('--api-key', help='Obsidian Local REST API key')
    parser.add_argument('--output', help='Output directory (fallback if API is offline)',
                        default='./imported_memories')
    parser.add_argument('--dry-run', action='store_true', help='Preview without saving')
    
    args = parser.parse_args()
    
    # Load API key
    global API_KEY
    if args.api_key:
        API_KEY = args.api_key
    else:
        load_api_key()
    
    # Parse conversations
    if args.platform == 'chatgpt':
        if not args.file:
            print("[ERROR] --file is required for ChatGPT import")
            sys.exit(1)
        conversations = parse_chatgpt(args.file)
    elif args.platform == 'claude':
        if not args.file:
            print("[ERROR] --file is required for Claude import")
            sys.exit(1)
        conversations = parse_claude(args.file)
    elif args.platform == 'gemini':
        if not args.folder:
            print("[ERROR] --folder is required for Gemini import")
            sys.exit(1)
        conversations = parse_gemini(args.folder)
    
    if not conversations:
        print("[INFO] No conversations found. Check your export file.")
        return
    
    print(f"\n{'='*50}")
    print(f"  Ready to import {len(conversations)} conversations")
    print(f"  Platform: {args.platform}")
    print(f"  Vault folder: {VAULT_FOLDER}/")
    print(f"{'='*50}\n")
    
    if args.dry_run:
        print("[DRY RUN] Previewing first 3 conversations:\n")
        for c in conversations[:3]:
            print(f"  - {c['title']} ({len(c['turns'])} turns, {c['date'].strftime('%Y-%m-%d')})")
        print(f"\n  ...and {max(0, len(conversations) - 3)} more.")
        return
    
    # Check if Obsidian API is available
    use_api = False
    try:
        resp = requests.get(f"{OBSIDIAN_API}/", headers={"Authorization": f"Bearer {API_KEY}"}, timeout=3)
        if resp.status_code == 200:
            use_api = True
            print("[OK] Connected to Obsidian REST API")
    except:
        pass
    
    if not use_api:
        output_dir = Path(args.output)
        output_dir.mkdir(parents=True, exist_ok=True)
        print(f"[WARN] Obsidian API offline. Saving to {output_dir}/")
    
    # Import each conversation
    saved = 0
    skipped = 0
    failed = 0
    
    for idx, convo in enumerate(conversations):
        title = convo['title']
        turns = convo['turns']
        date_obj = convo['date']
        date_str = date_obj.strftime('%Y-%m-%d')
        
        # Generate hash for dedup
        raw = json.dumps(turns, ensure_ascii=False)
        convo_hash = hashlib.md5(raw.encode()).hexdigest()
        
        filename = generate_filename(title, args.platform, date_str)
        markdown = build_markdown(title, args.platform, turns, date_obj, convo_hash)
        
        # Save
        success = False
        if use_api:
            success = save_to_obsidian(filename, markdown)
        else:
            success = save_to_file(Path(args.output), filename, markdown)
        
        if success:
            saved += 1
            progress = f"[{idx+1}/{len(conversations)}]"
            print(f"  {progress} Saved: {filename}")
        else:
            failed += 1
            print(f"  [FAIL] {filename}")
    
    print(f"\n{'='*50}")
    print(f"  Import Complete!")
    print(f"  Saved:   {saved}")
    print(f"  Failed:  {failed}")
    print(f"  Total:   {len(conversations)}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
