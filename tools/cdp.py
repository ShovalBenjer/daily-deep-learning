"""Resolve a Chrome DevTools endpoint and drive it, without guessing the host.

Purpose: DESIGN.md step 5 requires verifying every UI change on the live site by
CDP screenshot at 390px. That check kept failing because Chrome may bind its
debug port to IPv6 loopback only, so a hardcoded 127.0.0.1 gets
ECONNREFUSED while the browser is plainly running.

Contracts: endpoint() returns a URL that answered /json/version, or raises.
Callers may rely on the returned browser already being connected. Nothing here
launches or kills Chrome; an already-running instance is adopted as-is.

Agent-context: call endpoint() or shots(). Do not hardcode a loopback host
anywhere else in this repo.

Typical usage::

    python tools/cdp.py https://daily-deep-learning.pages.dev shots/live
"""

import sys
import urllib.request

PORTS = (9224, 9222, 9223, 9225)
HOSTS = ("localhost", "[::1]", "127.0.0.1")
ROUTES = ("", "#/map", "#/ladder", "#/kodex", "#/discover")


def endpoint(timeout: float = 2.0) -> str:
    """Return the first CDP HTTP endpoint that responds.

    Args:
        timeout: per-probe socket timeout in seconds.

    Returns:
        A base URL such as "http://localhost:9224".

    Raises:
        RuntimeError: no host and port combination answered.

    Examples:
        >>> endpoint().startswith("http://")
        True
    """
    for port in PORTS:
        for host in HOSTS:
            url = f"http://{host}:{port}"
            try:
                with urllib.request.urlopen(f"{url}/json/version", timeout=timeout) as r:
                    if r.status == 200:
                        return url
            except (OSError, urllib.error.URLError):
                continue
    raise RuntimeError(
        f"no CDP endpoint on ports {PORTS}. Start Chrome with --remote-debugging-port."
    )


def shots(base: str, outdir: str, width: int = 390, height: int = 844) -> list[str]:
    """Screenshot every hash route of a deployed app at phone width.

    Args:
        base: site root, e.g. "https://daily-deep-learning.pages.dev".
        outdir: directory to write PNGs into.
        width: viewport width. 390 is the DESIGN.md verification width.
        height: viewport height.

    Returns:
        Paths of the files written.
    """
    import pathlib

    from playwright.sync_api import sync_playwright  # type: ignore

    out = pathlib.Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    written = []

    with sync_playwright() as pw:
        browser = pw.chromium.connect_over_cdp(endpoint())
        page = browser.contexts[0].new_page()
        page.set_viewport_size({"width": width, "height": height})
        try:
            for route in ROUTES:
                url = base.rstrip("/") + "/" + (("#/" + route[2:]) if route else "")
                page.goto(url, wait_until="networkidle", timeout=45000)
                page.wait_for_timeout(1800)
                name = (route.replace("#/", "") or "home") + ".png"
                path = out / name
                page.screenshot(path=str(path), full_page=True)
                written.append(str(path))
                print(f"  {name:<14} {path.stat().st_size:>8} bytes  {page.title()[:40]}")
        finally:
            page.close()
    return written


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        print("endpoint:", endpoint())
        shots(sys.argv[1], sys.argv[2])
    else:
        print(endpoint())
