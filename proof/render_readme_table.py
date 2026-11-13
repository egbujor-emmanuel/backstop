"""Renders the README's proof table from proof/testnet-v2.jsonl.

Every row links the full transaction hash on the Mezo testnet explorer. Run from the repo root:
    python proof/render_readme_table.py
It rewrites the block between the PROOF-TABLE markers in README.md and nothing else.
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOG = ROOT / "proof" / "testnet-v2.jsonl"
README = ROOT / "README.md"
EXPLORER = "https://explorer.test.mezo.org/tx/"
START, END = "<!-- PROOF-TABLE:START -->", "<!-- PROOF-TABLE:END -->"


def main() -> int:
    rows = [json.loads(line) for line in LOG.read_text(encoding="utf-8").splitlines() if line.strip()]
    lines = ["| # | Step | Transaction |", "|---|---|---|"]
    for i, row in enumerate(rows, 1):
        tx = row["tx"]
        if len(tx) != 66 or not tx.startswith("0x"):
            print(f"bad hash in row {i}: {tx}", file=sys.stderr)
            return 1
        label = row["label"].replace("|", "\\|")
        lines.append(f"| {i} | {label} | [`{tx[:10]}…{tx[-4:]}`]({EXPLORER}{tx}) |")
    text = README.read_text(encoding="utf-8")
    if text.count(START) != 1 or text.count(END) != 1:
        print("README markers missing", file=sys.stderr)
        return 1
    head, rest = text.split(START)
    _, tail = rest.split(END)
    README.write_text(head + START + "\n" + "\n".join(lines) + "\n" + END + tail, encoding="utf-8", newline="\n")
    print(f"{len(rows)} rows rendered")
    return 0


if __name__ == "__main__":
    sys.exit(main())
