#!/usr/bin/env python3
"""perf-baseline.py (Task 90, round 2) - measured, repeatable performance baseline.

Measures against the RUNNING server (prod standalone on :3000):
  1. API latency: N samples per endpoint (median + p95), doc-optimal 50 in prod.
  2. Client bundle: per-route first-load JS from .next build manifests.
  3. Static chunk totals: top-N largest chunks in .next/static.

Writes JSON to scripts/.perf-baseline.json for before/after diffs.
Usage: python3 scripts/perf-baseline.py [samples]  (default 12)
"""
import json
import statistics
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEXT = ROOT / ".next"
BASE = "http://localhost:3000"
SAMPLES = int(sys.argv[1]) if len(sys.argv) > 1 else 12

UA = {"User-Agent": "perf-baseline/1.0"}


def timed(path: str) -> float:
    """One GET, returns elapsed ms. Follows redirects; fails loudly."""
    req = urllib.request.Request(BASE + path, headers=UA)
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=15) as r:
        r.read()
    return (time.perf_counter() - t0) * 1000.0


def measure_apis() -> dict:
    # Warm-up round (JIT caches, Prisma query plan cache, OS page cache).
    for p in ("/", "/api/version", "/api/state", "/api/review/queue", "/api/progress"):
        try:
            timed(p)
        except Exception:
            pass
    out = {}
    for p in ("/", "/api/version", "/api/state", "/api/review/queue", "/api/progress"):
        xs = []
        for _ in range(SAMPLES):
            try:
                xs.append(timed(p))
            except Exception as e:
                out[p] = {"error": str(e)[:120]}
                break
        if xs:
            xs_sorted = sorted(xs)
            p95 = xs_sorted[min(len(xs_sorted) - 1, int(len(xs_sorted) * 0.95))]
            out[p] = {
                "n": len(xs),
                "median_ms": round(statistics.median(xs), 1),
                "p95_ms": round(p95, 1),
                "min_ms": round(min(xs), 1),
                "max_ms": round(max(xs), 1),
            }
    return out


def measure_bundles() -> dict:
    """App-router client payload: .next/static/chunks/app/<route>/ per route +
    shared (top-level) chunks + grand totals. Standalone-build compatible."""
    chunks_dir = NEXT / "static" / "chunks"
    if not chunks_dir.exists():
        return {"error": ".next/static/chunks missing"}
    per_route = {}
    shared = 0
    count = 0
    for f in chunks_dir.rglob("*.js"):
        size = f.stat().st_size
        count += 1
        rel = f.relative_to(chunks_dir)
        if rel.parts[0] == "app" and len(rel.parts) > 2:
            # .next/static/chunks/app/<route>/... -> route key
            route_key = "/".join(rel.parts[1:-1])
            route_key = "(root)" if route_key.startswith("(") else "/" + route_key
            per_route.setdefault(route_key, 0)
            per_route[route_key] += size
        else:
            shared += size
    routes_kb = {k: round(v / 1024, 1) for k, v in sorted(per_route.items())}
    top = sorted(
        ((str(f.relative_to(chunks_dir)), f.stat().st_size) for f in chunks_dir.rglob("*.js")),
        key=lambda kv: -kv[1],
    )[:12]
    total = shared + sum(per_route.values())
    return {
        "route_first_load_kb": routes_kb,
        "shared_chunks_kb": round(shared / 1024, 1),
        "total_client_js_mb": round(total / 1024 / 1024, 2),
        "js_chunk_count": count,
        "top_chunks_kb": [(k.split("/")[-1], round(v / 1024, 1)) for k, v in top],
    }


def main() -> None:
    result = {
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "samples": SAMPLES,
        "apis": measure_apis(),
        "bundles": measure_bundles(),
    }
    out = ROOT / "scripts" / ".perf-baseline.json"
    out.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
