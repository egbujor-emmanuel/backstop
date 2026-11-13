"""Locate chain halts on Mezo mainnet from block headers.

Usage: python halt_scan.py <rpc_url> <from_iso_utc> <to_iso_utc> [min_gap_seconds]

Walks every block between the two timestamps and prints each gap between consecutive
blocks that is at least min_gap_seconds (default 600), plus block-time statistics.
Reads public chain data only.
"""
import datetime as dt
import json
import statistics
import sys
import urllib.request

RPC = sys.argv[1]
T0 = int(dt.datetime.fromisoformat(sys.argv[2]).replace(tzinfo=dt.timezone.utc).timestamp())
T1 = int(dt.datetime.fromisoformat(sys.argv[3]).replace(tzinfo=dt.timezone.utc).timestamp())
MIN_GAP = int(sys.argv[4]) if len(sys.argv) > 4 else 600
BATCH = int(sys.argv[5]) if len(sys.argv) > 5 else 50


def rpc(calls):
    body = json.dumps([
        {"jsonrpc": "2.0", "id": i, "method": m, "params": p} for i, (m, p) in enumerate(calls)
    ]).encode()
    req = urllib.request.Request(RPC, data=body, headers={"content-type": "application/json", "user-agent": "backstop-backtest"})
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.load(r)
    out.sort(key=lambda x: x["id"])
    for o in out:
        if "error" in o:
            raise RuntimeError(o["error"])
    return [o["result"] for o in out]


def ts(n):
    return int(rpc([("eth_getBlockByNumber", [hex(n), False])])[0]["timestamp"], 16)


def block_at(target, lo, hi):
    """First block with timestamp >= target."""
    while lo < hi:
        mid = (lo + hi) // 2
        if ts(mid) < target:
            lo = mid + 1
        else:
            hi = mid
    return lo


head = int(rpc([("eth_blockNumber", [])])[0], 16)
b0 = block_at(T0, 1, head)
b1 = block_at(T1, b0, head)
print(f"blocks {b0}..{b1} ({b1 - b0} blocks)")

stamps = []
for start in range(b0, b1 + 1, BATCH):
    nums = range(start, min(start + BATCH, b1 + 1))
    res = rpc([("eth_getBlockByNumber", [hex(n), False]) for n in nums])
    stamps += [(int(r["number"], 16), int(r["timestamp"], 16)) for r in res]

gaps = [(stamps[i][0], stamps[i - 1][1], stamps[i][1], stamps[i][1] - stamps[i - 1][1]) for i in range(1, len(stamps))]
deltas = [g[3] for g in gaps]
normal = [d for d in deltas if d < MIN_GAP]
print(f"block time: median {statistics.median(normal)}s, mean {statistics.mean(normal):.2f}s, "
      f"p99 {sorted(normal)[int(len(normal) * 0.99)]}s, max-normal {max(normal)}s")
for num, a, b, d in gaps:
    if d >= MIN_GAP:
        f = lambda t: dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        print(f"GAP block {num - 1}->{num}: {f(a)} -> {f(b)} UTC = {d}s ({d / 3600:.2f}h)")
