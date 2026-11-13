// Generated from contracts/out/ClaimsCourt.sol/ClaimsCourt.json. Do not edit.
export const claimsCourtAbi = [
 {
  "type": "constructor",
  "inputs": [
   {
    "name": "musd_",
    "type": "address",
    "internalType": "contract IERC20"
   },
   {
    "name": "policyManager_",
    "type": "address",
    "internalType": "contract PolicyManager"
   },
   {
    "name": "veMEZO_",
    "type": "address",
    "internalType": "contract IVotingEscrow"
   },
   {
    "name": "votingPeriod_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "minQuorum_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "quorumBps_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "minVoters_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "approvalBps_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "minLockTail_",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "BOND_BPS",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MAX_EVIDENCE_LENGTH",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MIN_BOND",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "MIN_PAYOUT_GAS",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "REWARD_SLICE_BPS",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "approvalBps",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "bondFor",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "pure"
 },
 {
  "type": "function",
  "name": "bondOwed",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "claimCount",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "claimReward",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "claims",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "tuple",
    "internalType": "struct ClaimsCourt.Claim",
    "components": [
     {
      "name": "policyId",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "claimant",
      "type": "address",
      "internalType": "address"
     },
     {
      "name": "amount",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "bond",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "incidentAt",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "filedAt",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "votingEnds",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "outcome",
      "type": "uint8",
      "internalType": "enum ClaimsCourt.Outcome"
     },
     {
      "name": "payoutPending",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "voters",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "quorum",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "yesWeight",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "noWeight",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "rewardPot",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "evidenceURI",
      "type": "string",
      "internalType": "string"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "currentQuorum",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "fileClaim",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "incidentAt",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "evidenceURI",
    "type": "string",
    "internalType": "string"
   }
  ],
  "outputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "finalize",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "outcome",
    "type": "uint8",
    "internalType": "enum ClaimsCourt.Outcome"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "minLockTail",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "minQuorum",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "minVoters",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "musd",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IERC20"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "notifyRewards",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "pendingReward",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "policyManager",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract PolicyManager"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "quorumBps",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "retryPayout",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "rewardPool",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "rewardsDrawn",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "veMEZO",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IVotingEscrow"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "vote",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "approve",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "voteWeight",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "votes",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "voter",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "weight",
    "type": "uint128",
    "internalType": "uint128"
   },
   {
    "name": "approve",
    "type": "bool",
    "internalType": "bool"
   },
   {
    "name": "rewarded",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "votingPeriod",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "weightAt",
  "inputs": [
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "filedAt",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "votingEnds",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "weight",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "withdrawBond",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "event",
  "name": "BondHeld",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "BondWithdrawn",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "claimant",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ClaimFiled",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "policyId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "claimant",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "incidentAt",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "votingEnds",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "quorum",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "evidenceURI",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ClaimFinalized",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "outcome",
    "type": "uint8",
    "indexed": false,
    "internalType": "enum ClaimsCourt.Outcome"
   },
   {
    "name": "yesWeight",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "noWeight",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "rewardPot",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "PayoutCompleted",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "PayoutDeferred",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "reason",
    "type": "bytes",
    "indexed": false,
    "internalType": "bytes"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "RewardPaid",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "voter",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "RewardsNotified",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "rewardPool",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Voted",
  "inputs": [
   {
    "name": "claimId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "voter",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "approve",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
   },
   {
    "name": "weight",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "error",
  "name": "AlreadyVoted",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadAmount",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadConfig",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadEvidence",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadIncidentTime",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ClaimWindowClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ClaimantCannotVote",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InsufficientGas",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NoPayoutPending",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NoWeight",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotHolder",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotPending",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotPolicyManager",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotTokenOwner",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NothingToClaim",
  "inputs": []
 },
 {
  "type": "error",
  "name": "QuorumUnavailable",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ReentrancyGuardReentrantCall",
  "inputs": []
 },
 {
  "type": "error",
  "name": "SafeCastOverflowedUintDowncast",
  "inputs": [
   {
    "name": "bits",
    "type": "uint8",
    "internalType": "uint8"
   },
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "SafeCastOverflowedUintToInt",
  "inputs": [
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "SafeERC20FailedOperation",
  "inputs": [
   {
    "name": "token",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "UnknownClaim",
  "inputs": []
 },
 {
  "type": "error",
  "name": "VotingClosed",
  "inputs": []
 },
 {
  "type": "error",
  "name": "VotingOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroAddress",
  "inputs": []
 }
] as const;
