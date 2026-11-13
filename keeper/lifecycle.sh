#!/usr/bin/env bash
# Runs the BACKSTOP lifecycle on Mezo testnet with real transactions and logs every hash.
# Every step checks chain state first, so re-running a phase never repeats a transaction.
#
#   open      underwrite, buy three policies
#   claims    file two drill claims (DRILL-001 approve, DRILL-002 reject); assessors vote
#   finalize  after the vote: finalize both, pay assessor rewards, request an underwriter withdrawal
#   exit      after the cooldown: the underwriter withdraws free capital
#
# Addresses come from contracts/deployments/31611.json. Keys come from ~/.backstop/*.env and
# are never printed. Requires cast (Foundry) and python on PATH.
set -uo pipefail
PHASE="${1:?usage: lifecycle.sh open|claims|finalize|exit}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/proof/testnet-v2.jsonl"
mkdir -p "$ROOT/proof"
set -a
. "$HOME/.backstop/deployer.env"
. "$HOME/.backstop/team-wallets.env"
set +a

die() { echo "ERROR: $*" >&2; exit 1; }
DEP="$ROOT/contracts/deployments/31611.json"
[ -f "$DEP" ] || die "missing $DEP"
read -r POOL PM COURT < <(python -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(d['pool'],d['policyManager'],d['claimsCourt'])" "$DEP" < /dev/null | tr -d '\r') || die "cannot read $DEP"

R=https://rpc.test.mezo.org
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
REPO=https://github.com/egbujor-emmanuel/backstop/blob/main
E18=000000000000000000
MAXP=$(( 2**62 ))000000 # generous max premium for scripted buys; the app passes the exact quote + 1%

send() { # label, private key, then cast send args
  local label="$1" pk="$2"; shift 2
  local out hash status
  out=$(cast send "$@" --private-key "$pk" --rpc-url "$R" --json 2>&1) || die "$label: $(echo "$out" | tail -2)"
  hash=$(echo "$out" | python -I -c "import json,sys;print(json.load(sys.stdin)['transactionHash'])" 2>/dev/null) || die "$label: no hash in output"
  status=$(echo "$out" | python -I -c "import json,sys;print(int(json.load(sys.stdin)['status'],16))" 2>/dev/null)
  [ "$status" = "1" ] || die "$label reverted: $hash"
  printf '{"label":"%s","tx":"%s","ts":%s}\n' "$label" "$hash" "$(date +%s)" >> "$LOG"
  echo "ok  $label  $hash"
}
call() { cast call "$@" --rpc-url "$R" 2>/dev/null | head -1 | awk '{print $1}'; }
policy_field() { # policyId fieldIndex(1-based)
  cast call "$PM" "policies(uint256)((uint32,uint8,bool,uint8,uint8,uint64,uint64,uint128,uint128,uint256,address))" "$1" --rpc-url "$R" \
    | tr -d "()" | cut -d, -f"$2" | awk '{print $1}'
}
voted() { cast call "$COURT" "votes(uint256,uint256)(address,uint128,bool,bool)" "$1" "$2" --rpc-url "$R" | sed -n 2p | awk '{print $1}'; }

case "$PHASE" in
open)
  # Each step is skipped when chain state shows it already happened, so the phase can resume.
  if [ "$(call "$POOL" "totalSupply()(uint256)")" = "0" ]; then
    send "underwriter approves pool for 900 MUSD" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$POOL" 900$E18
    send "underwriter deposits 900 MUSD (idle share parked in sMUSD)" "$DEPLOYER_PRIVATE_KEY" "$POOL" "deposit(uint256,address)" 900$E18 "$DEPLOYER_ADDRESS"
  fi
  NEXT=$(call "$PM" "nextPolicyId()(uint256)")
  if [ "$NEXT" -le 1 ]; then
    send "trove owner approves policy manager" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$PM" 50$E18
    send "trove owner insures own MUSD trove: 500 MUSD, 30 days" "$DEPLOYER_PRIVATE_KEY" "$PM" "buy(uint256,uint256,uint256,uint256,uint256)" 1 500$E18 2592000 0 "$MAXP"
  fi
  [ "$(call $MUSD "allowance(address,address)(uint256)" "$BUYER_ADDRESS" "$PM")" = "0" ] && [ "$NEXT" -le 2 ] \
    && send "buyer approves policy manager" "$BUYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$PM" 50$E18
  [ "$(call $MUSD "allowance(address,address)(uint256)" "$BUYER_ADDRESS" "$COURT")" = "0" ] \
    && send "buyer approves claims court for bonds" "$BUYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" "$COURT" 10$E18
  NEXT=$(call "$PM" "nextPolicyId()(uint256)")
  [ "$NEXT" -le 2 ] && send "buyer insures Tigris pools: 200 MUSD, 30 days" "$BUYER_PRIVATE_KEY" "$PM" "buy(uint256,uint256,uint256,uint256,uint256)" 2 200$E18 2592000 0 "$MAXP"
  NEXT=$(call "$PM" "nextPolicyId()(uint256)")
  [ "$NEXT" -le 3 ] && send "buyer insures transaction halt: 100 MUSD, 30 days" "$BUYER_PRIVATE_KEY" "$PM" "buy(uint256,uint256,uint256,uint256,uint256)" 3 100$E18 2592000 0 "$MAXP"
  echo "open phase complete: next policy id $(call "$PM" "nextPolicyId()(uint256)")"
  ;;
claims)
  P_TIGRIS=2; P_HALT=3; C0=0; C1=1
  N=$(call "$COURT" "claimCount()(uint256)")
  if [ "$N" -lt 1 ]; then
    send "DRILL-001: buyer files 150 MUSD claim on policy #$P_TIGRIS" "$BUYER_PRIVATE_KEY" "$COURT" "fileClaim(uint256,uint256,uint256,string)" $P_TIGRIS 150$E18 $(( $(policy_field $P_TIGRIS 6) + 1 )) "$REPO/docs/drills/DRILL-001.md"
  fi
  if [ "$N" -lt 2 ]; then
    send "DRILL-002: buyer files 100 MUSD claim on policy #$P_HALT" "$BUYER_PRIVATE_KEY" "$COURT" "fileClaim(uint256,uint256,uint256,string)" $P_HALT 100$E18 $(( $(policy_field $P_HALT 6) + 1 )) "$REPO/docs/drills/DRILL-002.md"
  fi
  [ "$(voted $C0 952)" = "0" ] && send "assessor A (veMEZO #952) votes APPROVE on claim #$C0" "$ASSESSOR_A_PRIVATE_KEY" "$COURT" "vote(uint256,uint256,bool)" $C0 952 true
  [ "$(voted $C0 953)" = "0" ] && send "assessor B (veMEZO #953) votes APPROVE on claim #$C0" "$ASSESSOR_B_PRIVATE_KEY" "$COURT" "vote(uint256,uint256,bool)" $C0 953 true
  [ "$(voted $C1 952)" = "0" ] && send "assessor A (veMEZO #952) votes REJECT on claim #$C1" "$ASSESSOR_A_PRIVATE_KEY" "$COURT" "vote(uint256,uint256,bool)" $C1 952 false
  [ "$(voted $C1 953)" = "0" ] && send "assessor B (veMEZO #953) votes REJECT on claim #$C1" "$ASSESSOR_B_PRIVATE_KEY" "$COURT" "vote(uint256,uint256,bool)" $C1 953 false
  echo "Voting closes about $(date -u -d @$(( $(date +%s) + 3600 )))"
  ;;
finalize)
  for c in 0 1; do
    outcome=$(cast call "$COURT" "claims(uint256)((uint256,address,uint128,uint128,uint64,uint64,uint64,uint8,bool,uint32,uint128,uint128,uint128,uint128,string))" $c --rpc-url "$R" | tr -d "()" | cut -d, -f8 | awk '{print $1}')
    if [ "$outcome" = "0" ]; then
      label=$([ $c = 0 ] && echo "finalize claim #0 (DRILL-001): approved, 150 MUSD paid" || echo "finalize claim #1 (DRILL-002): rejected, bond to assessors")
      send "$label" "$DEPLOYER_PRIVATE_KEY" "$COURT" "finalize(uint256)" $c
    fi
  done
  for c in 0 1; do for id in 952 953; do
    if [ "$(call "$COURT" "pendingReward(uint256,uint256)(uint256)" $c $id)" != "0" ]; then
      send "assessor reward paid: claim #$c, veMEZO #$id" "$DEPLOYER_PRIVATE_KEY" "$COURT" "claimReward(uint256,uint256)" $c $id
    fi
  done; done
  SHARES=$(call "$POOL" "balanceOf(address)(uint256)" "$DEPLOYER_ADDRESS")
  send "underwriter requests withdrawal of all shares (1h cooldown)" "$DEPLOYER_PRIVATE_KEY" "$POOL" "requestWithdraw(uint256)" "$SHARES"
  ;;
exit)
  MAX=$(call "$POOL" "maxWithdraw(address)(uint256)" "$DEPLOYER_ADDRESS")
  [ "$MAX" != "0" ] || die "nothing withdrawable yet (cooldown running or no request)"
  send "underwriter withdraws free capital; active cover stays backed" "$DEPLOYER_PRIVATE_KEY" "$POOL" "withdraw(uint256,address,address)" "$MAX" "$DEPLOYER_ADDRESS" "$DEPLOYER_ADDRESS"
  ;;
*) die "unknown phase $PHASE" ;;
esac
