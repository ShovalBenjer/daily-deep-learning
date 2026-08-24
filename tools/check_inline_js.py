# Syntax-check the inline <script> block(s) in index.html (no src attribute).
# This repo has no build step, so the app's own logic lives inline in
# index.html rather than in a file Node can check directly. This extracts
# every src-less <script>...</script> body and runs `node --check` on it.
#
# This is a syntax check only (parses the JS, catches nothing semantic).
# Used by the quality-contract "types" domain.
import os
import re
import subprocess
import sys
import tempfile

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(R, "index.html"), encoding="utf-8") as _fh:
    html = _fh.read()

# src-less <script> tags only; scripts with a src attribute are separate files.
blocks = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>", html)
if not blocks:
    print("no inline <script> blocks found in index.html")
    sys.exit(1)

failed = False
for i, body in enumerate(blocks):
    if not body.strip():
        continue
    fd, path = tempfile.mkstemp(suffix=".js")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(body)
        p = subprocess.run(["node", "--check", path], capture_output=True, text=True, check=False)
        status = "ok" if p.returncode == 0 else "FAIL"
        print(f"inline script #{i} ({len(body)} bytes): {status}")
        if p.returncode != 0:
            failed = True
            print(p.stderr)
    finally:
        os.unlink(path)

sys.exit(1 if failed else 0)
