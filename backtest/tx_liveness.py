"""Measure EVM transaction liveness on Mezo mainnet per time bucket.

Usage: python tx_liveness.py <rpc_url> <from_iso_utc> <to_iso_utc> [bucket_minutes]

For each bucket prints blocks produced, EVM transactions included, and the longest run of
consecutive blocks with zero EVM transactions. Reads public chain data only.
"""
import datetime as dt
import json
import sys
import urllib.request

RPC = sys.argv[1]
T0 = int(dt.datetime.fromisoformat(sys.argv[2]).replace(tzinfo=dt.timezone.utc).timestamp())
T1 = int(dt.datetime.fromisoformat(sys.argv[3]).replace(tzinfo=dt.timezone.utc).timestamp())
BUCKET = 60 * (int(sys.argv[4]) if len(sys.argv) > 4 else 30)
BATCH = 50


def rpc(calls: list) -> list:
    body = json.dumps([
        {"jsonrpc": "2.0", "id": i, "method": m, "params": p} for i, (m, p) in enumerate(calls)
    ]).encode()
    req = urllib.request.Request(
        RPC, data=body, headers={"content-type": "application/json", "user-agent": "backstop-backtest"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        out = json.load(r)
    out.sort(key=lambda x: x["id"])
    for o in out:
        if "error" in o:
            raise RuntimeError(o["error"])
    return [o["result"] for o in out]


def ts(n: int) -> int:
    return int(rpc([("eth_getBlockByNumber", [hex(n), False])])[0]["timestamp"], 16)


def block_at(target: int, lo: int, hi: int) -> int:
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

rows = []
for start in range(b0, b1 + 1, BATCH):
    nums = range(start, min(start + BATCH, b1 + 1))
    res = rpc([("eth_getBlockByNumber", [hex(n), False]) for n in nums])
    rows += [(int(r["number"], 16), int(r["timestamp"], 16), len(r["transactions"])) for r in res]

fmt = lambda t: dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%H:%M")
buckets: dict = {}
for num, t, n in rows:
    buckets.setdefault((t - T0) // BUCKET, []).append((num, t, n))

print("bucket(UTC)  blocks  evm_txs  longest_empty_run")
for k in sorted(buckets):
    b = buckets[k]
    run = best = 0
    for _, _, n in b:
        run = run + 1 if n == 0 else 0
        best = max(best, run)
    print(f"{fmt(T0 + k * BUCKET)}-{fmt(T0 + (k + 1) * BUCKET)}  {len(b):6}  {sum(n for *_, n in b):7}  {best:6}")

# First and last EVM transaction around the quiet period.
nonempty = [(num, t) for num, t, n in rows if n > 0]
gaps = [(nonempty[i - 1], nonempty[i]) for i in range(1, len(nonempty))]
(longest_a, longest_b) = max(gaps, key=lambda g: g[1][1] - g[0][1])
d = longest_b[1] - longest_a[1]
full = lambda t: dt.datetime.fromtimestamp(t, dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
print(f"\nLongest stretch with no EVM transaction: block {longest_a[0]} ({full(longest_a[1])} UTC) "
      f"-> block {longest_b[0]} ({full(longest_b[1])} UTC) = {d}s ({d / 3600:.2f}h), "
      f"{longest_b[0] - longest_a[0] - 1} empty blocks in between")
