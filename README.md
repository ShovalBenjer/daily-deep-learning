# daily-deep-learning

Personal daily learning site: one Hebrew post per day working through Stanford
CS224R (Deep RL) and MIT 6.S184 (Flow Matching), gadial-style, phone-first RTL
PWA. Open it on the iPhone, Share -> Add to Home Screen, and it behaves like an
app (offline included).

## Structure

- `index.html` - the whole app: post list, markdown rendering (marked), math
  (KaTeX auto-render), RTL dark theme. No build step.
- `posts/YYYY-MM-DD.md` - one post per day.
- `posts/index.json` - post manifest, newest first.
- `ROUTINE.md` - the contract the scheduled daily agent follows to add a post.
- `course_plan.json` - week-by-week lecture map + world-scan sources.
- `sw.js`, `manifest.webmanifest`, `icons/` - PWA shell (offline + home screen).

## Local preview

Any static server, e.g. `python -m http.server 8080`, then http://localhost:8080.

## Deploy

Cloudflare Pages, project `daily-deep-learning`. Manual deploy:
`bun x wrangler pages deploy . --project-name daily-deep-learning`
(needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment).
Pushes to `main` also deploy via the GitHub Action in `.github/workflows/`.

## Daily engine

A scheduled cloud agent runs each morning (06:00 Asia/Jerusalem), follows
`ROUTINE.md`, commits the new post, and the deploy pipeline republishes.
