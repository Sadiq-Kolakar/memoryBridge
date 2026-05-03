"""
MemoryBridge AutoPush - Automatically commits and pushes every 30 seconds.
Usage: python autopush.py
Press Ctrl+C to stop.
"""

import subprocess
import time
import os
import sys
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

REPO_DIR = os.path.dirname(os.path.abspath(__file__))
INTERVAL = 30  # seconds

def run(cmd):
    """Run a git command and return output."""
    result = subprocess.run(
        cmd, cwd=REPO_DIR, capture_output=True, text=True, shell=True
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()

def auto_push():
    print(f"[MemoryBridge] AutoPush started - pushing every {INTERVAL}s")
    print(f"[Repo] {REPO_DIR}")
    print(f"[Stop] Press Ctrl+C to stop.\n")

    while True:
        try:
            # Check for changes
            code, out, _ = run("git status --porcelain")

            if out:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # Stage all changes
                run("git add -A")

                # Commit with timestamp
                commit_msg = f"auto: sync @ {timestamp}"
                code, out, err = run(f'git commit -m "{commit_msg}"')

                if code == 0:
                    print(f"[OK] [{timestamp}] Committed: {commit_msg}")

                    # Push to origin
                    code, out, err = run("git push origin main")
                    if code == 0:
                        print(f"[PUSH] [{timestamp}] Pushed to origin/main")
                    else:
                        print(f"[WARN] [{timestamp}] Push failed: {err}")
                else:
                    print(f"[INFO] [{timestamp}] Nothing new to commit")
            else:
                now = datetime.now().strftime("%H:%M:%S")
                print(f"[IDLE] [{now}] No changes - sleeping {INTERVAL}s...")

            time.sleep(INTERVAL)

        except KeyboardInterrupt:
            print("\n\n[STOP] AutoPush stopped. Goodbye!")
            break

if __name__ == "__main__":
    auto_push()
