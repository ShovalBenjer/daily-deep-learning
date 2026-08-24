# Security Policy

## Overview

This repository contains a public-facing PWA, a Cloudflare Worker, and a Bun daemon.
Security is a first-class concern because the app serves learners directly and syncs
state across network boundaries.

## Reporting a Vulnerability

Please report vulnerabilities privately. Do not open a public issue for security
concerns. Instead, email the repository maintainer or use GitHub's private
vulnerability reporting feature.

## Key Risks

- The GitHub repository is public. Do not commit secrets, bearer keys, learner
  transcripts, or PII.
- The app uses `localStorage` and a single-worker sync endpoint. Protect the bearer
  key and rotate it if exposed.
- The daemon exposes MCP tools over a cloudflared tunnel. Restrict access to the
  tunnel and enforce bearer auth.

## Dependencies

- Update vendored libraries in `vendor/` promptly when security advisories are
  published.
- Run `python3 tools/check_docs_index.py` and `python tools/validate_links.py` as
  part of routine maintenance.

## Headers and Deployment

- Deploy the staged tree via `wrangler pages deploy dist`. The `_headers` file must
  be present in `dist/` to enforce CSP and other security headers.
- Do not assume `localhost:8080` applies `_headers`; header-dependent behavior must
  be verified on a deployed preview.

## Expected Behavior

- No commit should introduce new dependencies from CDNs or external origins without
  updating `_headers`.
- No script should log secrets, keys, or tokens.
