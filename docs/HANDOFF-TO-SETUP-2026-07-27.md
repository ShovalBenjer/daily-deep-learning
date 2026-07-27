# Handoff to the setup lane: flow.py cannot audit an IPv6 CDP endpoint

**From:** the learning platform (daily-deep-learning), 2026-07-27
**To:** lane B, claude-setup
**Why this is a proposal and not a patch:** the defect is in `claude-setup`, which
is another lane's tree. Per the charter this lane raises it rather than editing it.

## The defect

`claude-setup/tools/browser/cdp.py`, `WS.__init__` (line 332 in the copy read
2026-07-27):

```python
hostport, _, path = rest.partition("/")
host, _, port = hostport.partition(":")
self.sock = socket.create_connection((host, int(port or 80)), timeout=timeout)
```

`partition(":")` is not IPv6-aware. For the endpoint
`ws://[::1]:9224/devtools/browser/...` it yields `host = "["` and
`port = ":1]:9224"`, so `int(port)` raises:

```
ValueError: invalid literal for int() with base 10: ':1]:9224'
```

It raises inside `Page.__init__`, before the first route is audited, so
`flow.py audit` produces no report at all rather than a partial one.

## The endpoint choice that triggers it is correct

This is worth stating so the fix does not go in the wrong place. The same module
already reasons about exactly this machine's two-Chrome situation, and its
comment records the measurement: `127.0.0.1:9224` is a stranger Chrome on a
throwaway profile under Temp, `[::1]:9224` is the automation instance.
`choose_host()` deliberately prefers `[::1]` so the tooling does not hijack a
browser it does not own. That is right. Only the URL parsing is wrong.

Confirmed 2026-07-27 that both answer `/json/version`: the IPv4 one reports
`HeadlessChrome/150.0.0.0`, the IPv6 one `Chrome/150.0.0.0`.

## The documented workaround does not work

`HOST = os.environ.get("CDP_HOST") or HOST_CANDIDATES[0]` suggests
`CDP_HOST=127.0.0.1` should route around it. Verified on this machine: it does
not, because `choose_host()` overrides the env default at runtime. Setting it
and re-running the full gate reproduced the identical `ValueError`.

## Suggested fix

Bracket-aware parsing in `WS.__init__`, e.g. via `urllib.parse.urlsplit`, whose
`.hostname` and `.port` already handle `[::1]:9224` and strip the brackets.
`socket.create_connection` accepts the unbracketed `::1` directly.

`cdp.py` carries a selftest with `parse_listeners` and `choose_host` cases; a
case asserting `ws://[::1]:9224/x` parses to `("::1", 9224)` would have caught
this and would keep it caught.

## Impact on this lane

Two domains of `daily-deep-learning`'s quality contract are blocked, both waived
until 2026-08-10 with this document as the reason:

- `e2e` cannot run at all.
- `a11y_ux` grades the report `e2e` writes, so it is currently grading a stale
  file from an earlier tree. It is not merely red, it is **not evaluable**,
  which is the more dangerous state because the number still looks like a
  measurement.

Lifting both needs only a fresh `state/e2e/last.json`.
