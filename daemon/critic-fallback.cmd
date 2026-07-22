@echo off
rem הסדנה local critic: audits today's page if it exists and is not yet stamped audited.
cd /d C:\Users\shova\Downloads\daily-deep-learning
git pull -q
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set TODAY=%%i
if not exist posts\%TODAY%.md exit /b 0
findstr /c:"<!-- audited -->" posts\%TODAY%.md >nul && exit /b 0
claude -p "You are the page CRITIC for this repo (cwd). Audit posts/%TODAY%.md against ROUTINE.md exactly: five sections with the exact Hebrew prefixes, every quiz/fillin/widget fence is one line of valid JSON with required fields and 4 options, ids day-prefixed and unique across posts/ (grep), AI-103 quizzes in English, KaTeX delimiters only, no em-dash, self-contained bar (2500+ words, a hand-computed worked example, common-mistakes section, AI-103 taught inline), posts/index.json valid with today's entry. Fix ONLY violations with minimal edits, append a final line '<!-- audited -->', then git add posts/%TODAY%.md posts/index.json && git commit -m 'critic: %TODAY% (local)' && git push. If nothing to fix still append the marker and commit 'critic: %TODAY% clean (local)'." --dangerously-skip-permissions --max-turns 40 >> daemon\fallback.log 2>&1
exit /b 0
