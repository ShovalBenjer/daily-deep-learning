# Syntax-check the inline <script> block(s) in index.html (no src attribute).
# This repo has no build step, so the app's own logic lives inline in
# index.html rather than in a file Node can check directly. This extracts
# every src-less <script>...</script> body and runs `node --check` on it.
#
# This is a syntax check only (parses the JS, catches nothing semantic).
# Used by the quality-contract "types" domain.
import re
import subprocess
import sys
import tempfile
import os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(R, "index.html"), encoding="utf-8").read()

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
        p = subprocess.run(["node", "--check", path], capture_output=True, text=True)
        status = "ok" if p.returncode == 0 else "FAIL"
        print("inline script #{} ({} bytes): {}".format(i, len(body), status))
        if p.returncode != 0:
            failed = True
            print(p.stderr)
    finally:
        os.unlink(path)

sys.exit(1 if failed else 0)
