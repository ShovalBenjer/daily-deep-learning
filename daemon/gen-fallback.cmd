@echo off
rem הסדנה local fallback generator: runs at 06:10; no-op if the cloud routine already pushed today's page.
cd /d C:\Users\shova\Downloads\daily-deep-learning
git pull -q
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set TODAY=%%i
if exist posts\%TODAY%.md exit /b 0
claude -p "You are the daily page generator for this repo (cwd). Read ROUTINE.md and follow it EXACTLY (sections 1, 1b, 2, 2b, 3, 4) together with course_plan.json, judgment_map.json, research_ladder.json, talents.json. Learner state: GET https://sadna-sync.shovalb9.workers.dev with header Authorization: Bearer taken from daemon/.key. Write posts/%TODAY%.md as a FULL SELF-CONTAINED lesson per the contract, prepend the entry to posts/index.json, then git add ONLY those two files, commit 'post: %TODAY% (local-fallback)' and git push." --dangerously-skip-permissions --max-turns 60 >> daemon\fallback.log 2>&1
exit /b 0
