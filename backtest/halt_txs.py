"""List every EVM transaction Mezo mainnet included during the October 6, 2026 halt window.

Usage: python halt_txs.py <rpc_url> <from_block> <to_block> <out.json>

For each transaction: block, time, hash, sender, recipient, method selector and whether the
recipient is a contract. Shows who could still transact while ordinary users could not.
Reads public chain data only.
"""
import datetime as dt
import json
import sys
import time
import urllib.request

RPC, FROM, TO, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
BATCH = 50


def rpc(calls: list, attempts: int = 6) -> list:
    body = json.dumps([{"jsonrpc": "2.0", "id": i, "method": m, "params": p} for i, (m, p) in enumerate(calls)]).encode()
    req = urllib.request.Request(RPC, data=body, headers={"content-type": "application/json", "user-agent": "backstop-backtest"})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                out = json.load(r)
            break
        except Exception as exc:  # public RPCs drop connections under load; retry with backoff
            if attempt == attempts - 1:
                raise
            print(f"rpc retry {attempt + 1}: {exc}", file=sys.stderr)
            time.sleep(2 * (attempt + 1))
    out.sort(key=lambda x: x["id"])
    for o in out:
        if "error" in o:
            raise RuntimeError(o["error"])
    return [o["result"] for o in out]


def main() -> None:
    txs = []
    for start in range(FROM, TO + 1, BATCH):
        blocks = rpc([("eth_getBlockByNumber", [hex(n), True]) for n in range(start, min(start + BATCH, TO + 1))])
        for b in blocks:
            for t in b["transactions"]:
                txs.append({
                    "block": int(b["number"], 16),
                    "time": dt.datetime.fromtimestamp(int(b["timestamp"], 16), dt.timezone.utc).strftime("%H:%M:%S"),
                    "hash": t["hash"],
                    "from": t["from"],
                    "to": t.get("to"),
                    "selector": (t.get("input") or "0x")[:10],
                })
    if txs:
        codes = rpc([("eth_getCode", [t["to"], "latest"]) for t in txs if t["to"]])
        it = iter(codes)
        for t in txs:
            t["toIsContract"] = bool(t["to"]) and next(it) not in ("0x", "0x0")
    json.dump({"rpc": RPC, "fromBlock": FROM, "toBlock": TO, "transactions": txs}, open(OUT, "w"), indent=2)
    senders = {}
    for t in txs:
        senders[t["from"]] = senders.get(t["from"], 0) + 1
    print(f"{len(txs)} EVM transactions in blocks {FROM}-{TO}")
    for t in txs:
        print(f"  {t['time']} block {t['block']} from {t['from']} to {t['to']} {t['selector']}")
    print("distinct senders:", senders)


if __name__ == "__main__":
    main()
