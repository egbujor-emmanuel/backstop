#!/usr/bin/env bash
# Runs the BACKSTOP lifecycle on Mezo testnet with real transactions and logs every hash.
# Phase "open":     underwrite and buy three policies.
# Phase "claims":   file two drill claims; assessors vote.
# Phase "finalize": after the 1-hour vote, finalize both claims, pay assessor rewards,
#                   request an underwriter withdrawal.
# Phase "exit":     after the 1-hour cooldown, the underwriter withdraws free capital.
# Keys are read from ~/.backstop/*.env and never printed.
set -euo pipefail
PHASE="${1:?usage: lifecycle.sh open|claims|finalize|exit}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/proof/testnet.jsonl"
mkdir -p "$ROOT/proof"
set -a
. "$HOME/.backstop/deployer.env"
. "$HOME/.backstop/team-wallets.env"
set +a

R=https://rpc.test.mezo.org
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
POOL=0xa7D94fF3FDAF16ab8dAccB3706924a9B47e84C3C
PM=0x84EbA4A8067b3D6229aFA063508d465748Be1C6C
COURT=0x5C44309532184921421Bd7f9b1bCbE782F074C5b
REPO=https://github.com/egbujor-emmanuel/backstop/blob/main
E18=000000000000000000

send() { # label, private key, then cast send args
  local label="$1" pk="$2"; shift 2
  local out hash status
  out=$(cast send "$@" --private-key "$pk" --rpc-url "$R" --json)
  hash=$(echo "$out" | python -I -c "import json,sys;print(json.load(sys.stdin)['transactionHash'])")
  status=$(echo "$out" | python -I -c "import json,sys;print(int(json.load(sys.stdin)['status'],16))")
  if [ "$status" != "1" ]; then echo "FAILED: $label $hash" >&2; exit 1; fi
  printf '{"label":"%s","tx":"%s","ts":%s}\n' "$label" "$hash" "$(date +%s)" >> "$LOG"
  echo "ok  $label  $hash"
}
call() { cast call "$@" --rpc-url "$R" | awk '{print $1}'; }

case "$PHASE" in
open)
  send "underwriter approves pool" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" $POOL 1200$E18
  send "underwriter deposits 1,200 MUSD (90% parked in sMUSD)" "$DEPLOYER_PRIVATE_KEY" $POOL "deposit(uint256,address)" 1200$E18 $DEPLOYER_ADDRESS

  send "trove owner approves policy manager" "$DEPLOYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" $PM 50$E18
  send "trove owner insures own MUSD trove: 500 MUSD, 30 days" "$DEPLOYER_PRIVATE_KEY" $PM "buy(uint256,uint256,uint256,uint256)" 1 500$E18 2592000 0

  send "buyer approves policy manager" "$BUYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" $PM 50$E18
  send "buyer approves claims court (bonds)" "$BUYER_PRIVATE_KEY" $MUSD "approve(address,uint256)" $COURT 10$E18
  send "buyer insures Tigris pools: 200 MUSD, 30 days" "$BUYER_PRIVATE_KEY" $PM "buy(uint256,uint256,uint256,uint256)" 2 200$E18 2592000 0
  send "buyer insures transaction halt: 100 MUSD, 30 days" "$BUYER_PRIVATE_KEY" $PM "buy(uint256,uint256,uint256,uint256)" 3 100$E18 2592000 0

  ;;
claims)
  # Resumable: every step checks chain state first and is skipped if already done.
  P_TIGRIS=2; P_HALT=3; C0=0; C1=1
  policy_start() { # the incident must fall inside each policy's own coverage window
    cast call $PM "policies(uint256)((uint32,uint8,bool,uint8,uint64,uint64,uint128,uint128,uint256,address))" "$1" --rpc-url "$R" \
      | tr -d "()" | cut -d, -f5 | awk '{print $1}'
  }
  voted() { cast call $COURT "votes(uint256,uint256)(address,uint128,bool,bool)" "$1" "$2" --rpc-url "$R" | sed -n 2p | awk '{print $1}'; }
  N=$(call $COURT "claimCount()(uint256)")
  if [ "$N" -lt 1 ]; then
    send "DRILL-001: buyer files 150 MUSD claim on policy #$P_TIGRIS" "$BUYER_PRIVATE_KEY" $COURT "fileClaim(uint256,uint256,uint256,string)" $P_TIGRIS 150$E18 $(( $(policy_start $P_TIGRIS) + 1 )) "$REPO/docs/drills/DRILL-001.md"
  fi
  if [ "$N" -lt 2 ]; then
    send "DRILL-002: buyer files 100 MUSD claim on policy #$P_HALT" "$BUYER_PRIVATE_KEY" $COURT "fileClaim(uint256,uint256,uint256,string)" $P_HALT 100$E18 $(( $(policy_start $P_HALT) + 1 )) "$REPO/docs/drills/DRILL-002.md"
  fi
  [ "$(voted $C0 952)" = "0" ] && send "assessor A (veMEZO #952) votes APPROVE on claim #$C0" "$ASSESSOR_A_PRIVATE_KEY" $COURT "vote(uint256,uint256,bool)" $C0 952 true
  [ "$(voted $C0 953)" = "0" ] && send "assessor B (veMEZO #953) votes APPROVE on claim #$C0" "$ASSESSOR_B_PRIVATE_KEY" $COURT "vote(uint256,uint256,bool)" $C0 953 true
  [ "$(voted $C1 952)" = "0" ] && send "assessor A (veMEZO #952) votes REJECT on claim #$C1" "$ASSESSOR_A_PRIVATE_KEY" $COURT "vote(uint256,uint256,bool)" $C1 952 false
  [ "$(voted $C1 953)" = "0" ] && send "assessor B (veMEZO #953) votes REJECT on claim #$C1" "$ASSESSOR_B_PRIVATE_KEY" $COURT "vote(uint256,uint256,bool)" $C1 953 false
  printf 'CLAIM_APPROVE=%s\nCLAIM_REJECT=%s\n' $C0 $C1 > "$ROOT/proof/claims.env"
  echo "Voting closes about $(date -u -d @$(( $(date +%s) + 3600 )))"
  ;;
finalize)
  . "$ROOT/proof/claims.env"
  send "finalize claim #$CLAIM_APPROVE (DRILL-001): approved, 150 MUSD paid" "$DEPLOYER_PRIVATE_KEY" $COURT "finalize(uint256)" $CLAIM_APPROVE
  send "finalize claim #$CLAIM_REJECT (DRILL-002): rejected, bond to assessors" "$DEPLOYER_PRIVATE_KEY" $COURT "finalize(uint256)" $CLAIM_REJECT
  for c in $CLAIM_APPROVE $CLAIM_REJECT; do for id in 952 953; do
    send "assessor reward: claim #$c, veMEZO #$id" "$DEPLOYER_PRIVATE_KEY" $COURT "claimReward(uint256,uint256)" $c $id
  done; done
  SHARES=$(call $POOL "balanceOf(address)(uint256)" $DEPLOYER_ADDRESS)
  send "underwriter requests withdrawal of all shares (1h cooldown)" "$DEPLOYER_PRIVATE_KEY" $POOL "requestWithdraw(uint256)" $SHARES
  ;;
exit)
  MAX=$(call $POOL "maxWithdraw(address)(uint256)" $DEPLOYER_ADDRESS)
  send "underwriter withdraws free capital ($MAX wei); active cover stays backed" "$DEPLOYER_PRIVATE_KEY" $POOL "withdraw(uint256,address,address)" $MAX $DEPLOYER_ADDRESS $DEPLOYER_ADDRESS
  ;;
*) echo "unknown phase" >&2; exit 2 ;;
esac
