#!/usr/bin/env bash
# Exercises BACKSTOP's veBTC product against Mezo's real veBTC VotingEscrow, logging every hash.
# Every step checks chain state first, so re-running a phase never repeats a transaction.
#
#   open      underwriter adds capital; the team wallet locks testnet BTC in veBTC and insures that lock
#   claim     DRILL-003: the lock holder files a claim on the veBTC policy; assessors vote APPROVE
#   finalize  after the vote: finalize (payout from the pool) and pay assessor rewards
#
# Keys come from ~/.backstop/*.env and are never printed. Requires cast and python on PATH.
set -uo pipefail
PHASE="${1:?usage: vebtc_drill.sh open|claim|finalize}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/proof/testnet-v2.jsonl"
STATE="$ROOT/proof/vebtc-drill.json"
set -a
. "$HOME/.backstop/deployer.env"
. "$HOME/.backstop/team-wallets.env"
set +a

die() { echo "ERROR: $*" >&2; exit 1; }
DEP="$ROOT/contracts/deployments/31611.json"
read -r POOL PM COURT < <(python -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['pool'],d['policyManager'],d['claimsCourt'])" "$DEP" < /dev/null | tr -d '\r') || die "cannot read $DEP"

R=https://rpc.test.mezo.org
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
VEBTC=0xB63fcCd03521Cf21907627bd7fA465C129479231
BTC=0x7b7C000000000000000000000000000000000000
REPO=https://github.com/egbujor-emmanuel/backstop/blob/main
E18=000000000000000000
LOCK_WEI=2000000000000000      # 0.002 BTC
LOCK_SECONDS=2419200            # 28 days, veBTC's maximum lock
COVER=100$E18                  # 100 MUSD
DURATION=604800                 # 7 days, inside the lock
MAXP=$(( 2**62 ))000000
VEBTC_PRODUCT=5                 # product #0 named a stale mainnet veBTC; #5 names the live one (policy #8 was sold under #0)

send() { # label, private key, then cast send args; prints the tx hash
  local label="$1" pk="$2"; shift 2
  local out hash status
  out=$(cast send "$@" --private-key "$pk" --rpc-url "$R" --json 2>&1) || die "$label: $(echo "$out" | tail -2)"
  hash=$(echo "$out" | python -I -c "import json,sys;print(json.load(sys.stdin)['transactionHash'])" 2>/dev/null) || die "$label: no hash in output"
  status=$(echo "$out" | python -I -c "import json,sys;print(int(json.load(sys.stdin)['status'],16))" 2>/dev/null)
  [ "$status" = "1" ] || die "$label reverted: $hash"
  printf '{"label":"%s","tx":"%s","ts":%s}\n' "$label" "$hash" "$(date +%s)" >> "$LOG"
  echo "ok  $label  $hash" >&2
  echo "$hash"
}
call() { cast call "$@" --rpc-url "$R" 2>/dev/null | head -1 | awk '{print $1}'; }
state_get() { python -I -c "import json,sys;print(json.load(open(sys.argv[1])).get(sys.argv[2],''))" "$STATE" "$1" < /dev/null 2>/dev/null | tr -d '\r'; }
state_set() { python -I -c "
import json,sys,os
p,k,v=sys.argv[1],sys.argv[2],sys.argv[3]
d=json.load(open(p)) if os.path.exists(p) else {}
d[k]=v
json.dump(d,open(p,'w'),indent=2)" "$STATE" "$1" "$2" < /dev/null; }

case "$PHASE" in
open)
  # Bash integers overflow above ~9.2e18, so wei amounts are compared in Python.
  if python -I -c "import sys; sys.exit(0 if int(sys.argv[1]) < 120 * 10**18 else 1)" "$(call "$POOL" "freeCapital()(uint256)")" < /dev/null; then
    send "underwriter approves pool for 150 MUSD (veBTC drill)" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$POOL" 150$E18 >/dev/null
    send "underwriter deposits 150 MUSD so the veBTC policy is fully backed" "$DEPLOYER_PRIVATE_KEY" "$POOL" "deposit(uint256,address)" 150$E18 "$DEPLOYER_ADDRESS" >/dev/null
  fi
  LOCK_ID=$(state_get lockId)
  if [ -z "$LOCK_ID" ]; then
    send "lock holder approves Mezo veBTC to take 0.002 BTC" "$DEPLOYER_PRIVATE_KEY" $BTC "approve(address,uint256)" $VEBTC $LOCK_WEI >/dev/null
    HASH=$(send "lock holder locks 0.002 BTC in Mezo's veBTC for 28 days" "$DEPLOYER_PRIVATE_KEY" $VEBTC "createLock(uint256,uint256)" $LOCK_WEI $LOCK_SECONDS)
    # The new token id is the Transfer (mint) event's third topic.
    LOCK_ID=$(cast receipt "$HASH" --rpc-url $R --json | python -I -c "
import json,sys
r=json.load(sys.stdin)
mint='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
ids=[int(l['topics'][3],16) for l in r['logs'] if l['topics'][0]==mint and len(l['topics'])==4 and int(l['topics'][1],16)==0]
print(ids[0])" | tr -d '\r')
    [ -n "$LOCK_ID" ] || die "could not read the new veBTC token id"
    state_set lockId "$LOCK_ID"
  fi
  echo "veBTC lock #$LOCK_ID, insurable value $(call "$PM" "insurableValue(uint256,address,uint256)(uint256)" $VEBTC_PRODUCT "$DEPLOYER_ADDRESS" "$LOCK_ID") wei MUSD" >&2
  POLICY=$(state_get policyId)
  if [ -z "$POLICY" ]; then
    POLICY=$(call "$PM" "nextPolicyId()(uint256)")
    send "lock holder approves policy manager for the veBTC premium" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$PM" 10$E18 >/dev/null
    send "lock holder insures veBTC lock #$LOCK_ID: 100 MUSD, 7 days (policy #$POLICY)" "$DEPLOYER_PRIVATE_KEY" "$PM" "buy(uint256,uint256,uint256,uint256,uint256)" $VEBTC_PRODUCT $COVER $DURATION "$LOCK_ID" "$MAXP" >/dev/null
    state_set policyId "$POLICY"
  fi
  echo "veBTC policy #$POLICY" >&2
  ;;
claim)
  POLICY=$(state_get policyId); [ -n "$POLICY" ] || die "run open first"
  CLAIM=$(state_get claimId)
  if [ -z "$CLAIM" ]; then
    CLAIM=$(call "$COURT" "claimCount()(uint256)")
    START=$(cast call "$PM" "policies(uint256)((uint32,uint8,bool,uint8,uint8,uint64,uint64,uint128,uint128,uint256,address))" "$POLICY" --rpc-url $R | tr -d "()" | cut -d, -f6 | awk '{print $1}')
    send "lock holder approves claims court for the DRILL-003 bond" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$COURT" 2$E18 >/dev/null
    send "DRILL-003: veBTC lock holder files 100 MUSD claim on policy #$POLICY" "$DEPLOYER_PRIVATE_KEY" "$COURT" "fileClaim(uint256,uint256,uint256,string)" "$POLICY" $COVER $(( START + 1 )) "$REPO/docs/drills/DRILL-003.md" >/dev/null
    state_set claimId "$CLAIM"
  fi
  voted() { cast call "$COURT" "votes(uint256,uint256)(address,uint128,bool,bool)" "$CLAIM" "$1" --rpc-url "$R" | sed -n 2p | awk '{print $1}'; }
  [ "$(voted 952)" = "0" ] && send "assessor A (veMEZO #952) votes APPROVE on claim #$CLAIM (DRILL-003)" "$ASSESSOR_A_PRIVATE_KEY" "$COURT" "vote(uint256,uint256,bool)" "$CLAIM" 952 true >/dev/null
  [ "$(voted 953)" = "0" ] && send "assessor B (veMEZO #953) votes APPROVE on claim #$CLAIM (DRILL-003)" "$ASSESSOR_B_PRIVATE_KEY" "$COURT" "vote(uint256,uint256,bool)" "$CLAIM" 953 true >/dev/null
  echo "claim #$CLAIM voting ends at $(cast call "$COURT" "claims(uint256)((uint256,address,uint128,uint128,uint64,uint64,uint64,uint8,bool,uint32,uint128,uint128,uint128,uint128,string))" "$CLAIM" --rpc-url $R | tr -d '()' | cut -d, -f7 | awk '{print $1}')" >&2
  ;;
finalize)
  CLAIM=$(state_get claimId); [ -n "$CLAIM" ] || die "run claim first"
  OUTCOME=$(cast call "$COURT" "claims(uint256)((uint256,address,uint128,uint128,uint64,uint64,uint64,uint8,bool,uint32,uint128,uint128,uint128,uint128,string))" "$CLAIM" --rpc-url $R | tr -d '()' | cut -d, -f8 | awk '{print $1}')
  [ "$OUTCOME" = "0" ] && send "finalize claim #$CLAIM (DRILL-003): approved, 100 MUSD paid to the veBTC lock holder" "$DEPLOYER_PRIVATE_KEY" "$COURT" "finalize(uint256)" "$CLAIM" >/dev/null
  for id in 952 953; do
    if [ "$(call "$COURT" "pendingReward(uint256,uint256)(uint256)" "$CLAIM" $id)" != "0" ]; then
      send "assessor reward paid: claim #$CLAIM, veMEZO #$id" "$DEPLOYER_PRIVATE_KEY" "$COURT" "claimReward(uint256,uint256)" "$CLAIM" $id >/dev/null
    fi
  done
  ;;
*) die "unknown phase $PHASE" ;;
esac
