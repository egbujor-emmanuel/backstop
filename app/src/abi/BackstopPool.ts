// Generated from contracts/out/BackstopPool.sol/BackstopPool.json. Do not edit.
export const backstopPoolAbi = [
 {
  "type": "constructor",
  "inputs": [
   {
    "name": "musd_",
    "type": "address",
    "internalType": "contract IERC20"
   },
   {
    "name": "savings_",
    "type": "address",
    "internalType": "contract IMUSDSavingsRate"
   },
   {
    "name": "withdrawCooldown_",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "withdrawWindow_",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "BUFFER_BPS",
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
  "name": "PREMIUM_VEST",
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
  "name": "activeCover",
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
  "name": "allowance",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "spender",
    "type": "address",
    "internalType": "address"
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
  "name": "approve",
  "inputs": [
   {
    "name": "spender",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "asset",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "balanceOf",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
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
  "name": "convertToAssets",
  "inputs": [
   {
    "name": "shares",
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
  "name": "convertToShares",
  "inputs": [
   {
    "name": "assets",
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
  "name": "decimals",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "uint8",
    "internalType": "uint8"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "deposit",
  "inputs": [
   {
    "name": "assets",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "freeCapital",
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
  "name": "grossAssets",
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
  "name": "harvest",
  "inputs": [],
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
  "name": "lastPremiumUpdate",
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
  "name": "lockCover",
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
  "name": "lockedPremium",
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
  "name": "maxDeposit",
  "inputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
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
  "name": "maxMint",
  "inputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
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
  "name": "maxRedeem",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
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
  "name": "maxWithdraw",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
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
  "name": "mint",
  "inputs": [
   {
    "name": "shares",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "name",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "string",
    "internalType": "string"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "notifyPremium",
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
  "name": "parked",
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
  "name": "payClaim",
  "inputs": [
   {
    "name": "to",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "amount",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "coverReleased",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "policyManager",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "previewDeposit",
  "inputs": [
   {
    "name": "assets",
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
  "name": "previewMint",
  "inputs": [
   {
    "name": "shares",
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
  "name": "previewRedeem",
  "inputs": [
   {
    "name": "shares",
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
  "name": "previewWithdraw",
  "inputs": [
   {
    "name": "assets",
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
  "name": "rebalance",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "redeem",
  "inputs": [
   {
    "name": "shares",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "requestWithdraw",
  "inputs": [
   {
    "name": "shares",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "savings",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IMUSDSavingsRate"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "setPolicyManager",
  "inputs": [
   {
    "name": "policyManager_",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "symbol",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "string",
    "internalType": "string"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "totalAssets",
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
  "name": "totalSupply",
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
  "name": "transfer",
  "inputs": [
   {
    "name": "to",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "transferFrom",
  "inputs": [
   {
    "name": "from",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "to",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "unlockCover",
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
  "name": "unvestedPremium",
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
  "name": "utilizationBps",
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
  "name": "withdraw",
  "inputs": [
   {
    "name": "assets",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "withdrawCooldown",
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
  "name": "withdrawRequests",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "shares",
    "type": "uint128",
    "internalType": "uint128"
   },
   {
    "name": "unlockAt",
    "type": "uint64",
    "internalType": "uint64"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "withdrawWindow",
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
  "name": "yieldReadOk",
  "inputs": [],
  "outputs": [
   {
    "name": "ok",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "event",
  "name": "Approval",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "spender",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ClaimPaid",
  "inputs": [
   {
    "name": "to",
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
    "name": "coverReleased",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "CoverLocked",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "activeCover",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "CoverUnlocked",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "activeCover",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Deposit",
  "inputs": [
   {
    "name": "sender",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "owner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "assets",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "shares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ParkFailed",
  "inputs": [
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
  "name": "Parked",
  "inputs": [
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
  "name": "PolicyManagerSet",
  "inputs": [
   {
    "name": "policyManager",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "PremiumReceived",
  "inputs": [
   {
    "name": "amount",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "lockedPremium",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Transfer",
  "inputs": [
   {
    "name": "from",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "to",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "value",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Unparked",
  "inputs": [
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
  "name": "Withdraw",
  "inputs": [
   {
    "name": "sender",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "receiver",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "owner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "assets",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "shares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "WithdrawRequested",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "shares",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "unlockAt",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "YieldHarvested",
  "inputs": [
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
  "type": "error",
  "name": "AlreadySet",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadConfig",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ERC20InsufficientAllowance",
  "inputs": [
   {
    "name": "spender",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "allowance",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "needed",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC20InsufficientBalance",
  "inputs": [
   {
    "name": "sender",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "balance",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "needed",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC20InvalidApprover",
  "inputs": [
   {
    "name": "approver",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC20InvalidReceiver",
  "inputs": [
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC20InvalidSender",
  "inputs": [
   {
    "name": "sender",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC20InvalidSpender",
  "inputs": [
   {
    "name": "spender",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC4626ExceededMaxDeposit",
  "inputs": [
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "assets",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "max",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC4626ExceededMaxMint",
  "inputs": [
   {
    "name": "receiver",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "shares",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "max",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC4626ExceededMaxRedeem",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "shares",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "max",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC4626ExceededMaxWithdraw",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "assets",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "max",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ExceedsBalance",
  "inputs": []
 },
 {
  "type": "error",
  "name": "InsufficientFreeCapital",
  "inputs": [
   {
    "name": "requested",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "available",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "InsufficientLiquidity",
  "inputs": [
   {
    "name": "requested",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "available",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "NotDeployer",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotPolicyManager",
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
  "name": "WithdrawNotRequested",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroAddress",
  "inputs": []
 }
] as const;
