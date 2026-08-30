# Syntax-check the inline <script> block(s) in index.html (no src attribute)
# and all external scripts in src/.
# This repo has no build step, so the app's logic lives in src/app.js and a
# tiny inline theme-init in index.html. This extracts every src-less
# <script>...</script> body and runs `node --check` on it, then checks every
# .js file under src/.
#
# This is a syntax check only (parses the JS, catches nothing semantic).
# Used by the quality-contract "types" domain.
import glob
import re
import subprocess
import sys
import tempfile
import os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(R, "index.html"), encoding="utf-8").read()

failed = False

# src-less <script> tags only; scripts with a src attribute are separate files.
blocks = re.findall(r"<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>", html)
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

# External scripts under src/
src_dir = os.path.join(R, "src")
if os.path.isdir(src_dir):
    for js in sorted(glob.glob(os.path.join(src_dir, "**", "*.js"), recursive=True)):
        rel = os.path.relpath(js, R)
        p = subprocess.run(["node", "--check", js], capture_output=True, text=True)
        status = "ok" if p.returncode == 0 else "FAIL"
        sz = os.path.getsize(js)
        print("{} ({} bytes): {}".format(rel, sz, status))
        if p.returncode != 0:
            failed = True
            print(p.stderr)

if not blocks and not os.path.isdir(src_dir):
    print("no inline <script> blocks and no src/ directory found")
    sys.exit(1)

sys.exit(1 if failed else 0)
