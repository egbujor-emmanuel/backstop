// Generated from contracts/out/PolicyManager.sol/PolicyManager.json. Do not edit.
export const policyManagerAbi = [
 {
  "type": "constructor",
  "inputs": [
   {
    "name": "owner_",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "musd_",
    "type": "address",
    "internalType": "contract IERC20"
   },
   {
    "name": "pool_",
    "type": "address",
    "internalType": "contract BackstopPool"
   },
   {
    "name": "troveManager_",
    "type": "address",
    "internalType": "contract ITroveManager"
   },
   {
    "name": "priceFeed_",
    "type": "address",
    "internalType": "contract IPriceFeed"
   },
   {
    "name": "veBTC_",
    "type": "address",
    "internalType": "contract IVotingEscrow"
   },
   {
    "name": "treasury_",
    "type": "address",
    "internalType": "address"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "ASSESSOR_SHARE_BPS",
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
  "name": "CLAIM_GRACE",
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
  "name": "MAX_CLAIMS_PER_POLICY",
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
  "name": "MAX_DURATION",
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
  "name": "MAX_RATE_BPS",
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
  "name": "MIN_COVER",
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
  "name": "MIN_DURATION",
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
  "name": "PROTOCOL_FEE_BPS",
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
  "name": "acceptOwnership",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "addProduct",
  "inputs": [
   {
    "name": "name",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "coveredUri",
    "type": "string",
    "internalType": "string"
   },
   {
    "name": "annualRateBps",
    "type": "uint16",
    "internalType": "uint16"
   },
   {
    "name": "kind",
    "type": "uint8",
    "internalType": "enum PolicyManager.PositionKind"
   },
   {
    "name": "capacity",
    "type": "uint128",
    "internalType": "uint128"
   },
   {
    "name": "maxCoverPerPolicy",
    "type": "uint128",
    "internalType": "uint128"
   }
  ],
  "outputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "approve",
  "inputs": [
   {
    "name": "to",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "balanceOf",
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
  "name": "buy",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "cover",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "duration",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "positionId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "closeClaim",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "court",
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
  "name": "expire",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "getApproved",
  "inputs": [
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
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
  "name": "insurableValue",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "holder",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "positionId",
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
  "name": "insured",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "positionKey",
    "type": "bytes32",
    "internalType": "bytes32"
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
  "name": "isApprovedForAll",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "operator",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
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
  "name": "nextPolicyId",
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
  "name": "openClaim",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "owner",
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
  "name": "ownerOf",
  "inputs": [
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
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
  "name": "pause",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "paused",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "pendingOwner",
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
  "name": "policies",
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
    "type": "tuple",
    "internalType": "struct PolicyManager.Policy",
    "components": [
     {
      "name": "productId",
      "type": "uint32",
      "internalType": "uint32"
     },
     {
      "name": "status",
      "type": "uint8",
      "internalType": "enum PolicyManager.Status"
     },
     {
      "name": "claimOpen",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "claimsFiled",
      "type": "uint8",
      "internalType": "uint8"
     },
     {
      "name": "start",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "end",
      "type": "uint64",
      "internalType": "uint64"
     },
     {
      "name": "cover",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "premium",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "positionId",
      "type": "uint256",
      "internalType": "uint256"
     },
     {
      "name": "holder",
      "type": "address",
      "internalType": "address"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "pool",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract BackstopPool"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "priceFeed",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract IPriceFeed"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "productCount",
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
  "name": "products",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "tuple",
    "internalType": "struct PolicyManager.Product",
    "components": [
     {
      "name": "name",
      "type": "string",
      "internalType": "string"
     },
     {
      "name": "coveredUri",
      "type": "string",
      "internalType": "string"
     },
     {
      "name": "annualRateBps",
      "type": "uint16",
      "internalType": "uint16"
     },
     {
      "name": "kind",
      "type": "uint8",
      "internalType": "enum PolicyManager.PositionKind"
     },
     {
      "name": "active",
      "type": "bool",
      "internalType": "bool"
     },
     {
      "name": "capacity",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "activeCover",
      "type": "uint128",
      "internalType": "uint128"
     },
     {
      "name": "maxCoverPerPolicy",
      "type": "uint128",
      "internalType": "uint128"
     }
    ]
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "quote",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "cover",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "duration",
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
  "name": "renounceOwnership",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "safeTransferFrom",
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
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "safeTransferFrom",
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
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "data",
    "type": "bytes",
    "internalType": "bytes"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "setApprovalForAll",
  "inputs": [
   {
    "name": "operator",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "approved",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "setCourt",
  "inputs": [
   {
    "name": "court_",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "setTreasury",
  "inputs": [
   {
    "name": "treasury_",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "settleAssessedClaim",
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
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "supportsInterface",
  "inputs": [
   {
    "name": "interfaceId",
    "type": "bytes4",
    "internalType": "bytes4"
   }
  ],
  "outputs": [
   {
    "name": "",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "stateMutability": "view"
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
  "name": "tokenURI",
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
    "type": "string",
    "internalType": "string"
   }
  ],
  "stateMutability": "view"
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
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "transferOwnership",
  "inputs": [
   {
    "name": "newOwner",
    "type": "address",
    "internalType": "address"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "treasury",
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
  "name": "troveManager",
  "inputs": [],
  "outputs": [
   {
    "name": "",
    "type": "address",
    "internalType": "contract ITroveManager"
   }
  ],
  "stateMutability": "view"
 },
 {
  "type": "function",
  "name": "unpause",
  "inputs": [],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "updateProduct",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "annualRateBps",
    "type": "uint16",
    "internalType": "uint16"
   },
   {
    "name": "capacity",
    "type": "uint128",
    "internalType": "uint128"
   },
   {
    "name": "maxCoverPerPolicy",
    "type": "uint128",
    "internalType": "uint128"
   },
   {
    "name": "active",
    "type": "bool",
    "internalType": "bool"
   }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
 },
 {
  "type": "function",
  "name": "veBTC",
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
    "name": "approved",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ApprovalForAll",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "operator",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "approved",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ClaimClosed",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ClaimOpened",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "CourtSet",
  "inputs": [
   {
    "name": "court",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "OwnershipTransferStarted",
  "inputs": [
   {
    "name": "previousOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "newOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "OwnershipTransferred",
  "inputs": [
   {
    "name": "previousOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "newOwner",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Paused",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": false,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "PolicyBought",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "holder",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   },
   {
    "name": "productId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "cover",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "premium",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "start",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "end",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   },
   {
    "name": "positionId",
    "type": "uint256",
    "indexed": false,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "PolicyExpired",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "PolicyPaid",
  "inputs": [
   {
    "name": "policyId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "holder",
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
  "name": "ProductAdded",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "name",
    "type": "string",
    "indexed": false,
    "internalType": "string"
   },
   {
    "name": "kind",
    "type": "uint8",
    "indexed": false,
    "internalType": "enum PolicyManager.PositionKind"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "ProductUpdated",
  "inputs": [
   {
    "name": "productId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   },
   {
    "name": "annualRateBps",
    "type": "uint16",
    "indexed": false,
    "internalType": "uint16"
   },
   {
    "name": "capacity",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   },
   {
    "name": "maxCoverPerPolicy",
    "type": "uint128",
    "indexed": false,
    "internalType": "uint128"
   },
   {
    "name": "active",
    "type": "bool",
    "indexed": false,
    "internalType": "bool"
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
    "name": "tokenId",
    "type": "uint256",
    "indexed": true,
    "internalType": "uint256"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "TreasurySet",
  "inputs": [
   {
    "name": "treasury",
    "type": "address",
    "indexed": true,
    "internalType": "address"
   }
  ],
  "anonymous": false
 },
 {
  "type": "event",
  "name": "Unpaused",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "indexed": false,
    "internalType": "address"
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
  "name": "BadCover",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadDuration",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadPositionId",
  "inputs": []
 },
 {
  "type": "error",
  "name": "BadRate",
  "inputs": []
 },
 {
  "type": "error",
  "name": "CapacityExceeded",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ClaimAlreadyOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ClaimWindowOpen",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ERC721IncorrectOwner",
  "inputs": [
   {
    "name": "sender",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   },
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC721InsufficientApproval",
  "inputs": [
   {
    "name": "operator",
    "type": "address",
    "internalType": "address"
   },
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC721InvalidApprover",
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
  "name": "ERC721InvalidOperator",
  "inputs": [
   {
    "name": "operator",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC721InvalidOwner",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "ERC721InvalidReceiver",
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
  "name": "ERC721InvalidSender",
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
  "name": "ERC721NonexistentToken",
  "inputs": [
   {
    "name": "tokenId",
    "type": "uint256",
    "internalType": "uint256"
   }
  ]
 },
 {
  "type": "error",
  "name": "EmptyPosition",
  "inputs": []
 },
 {
  "type": "error",
  "name": "EnforcedPause",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ExceedsPositionValue",
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
  "name": "ExpectedPause",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotCourt",
  "inputs": []
 },
 {
  "type": "error",
  "name": "NotPositionOwner",
  "inputs": []
 },
 {
  "type": "error",
  "name": "OwnableInvalidOwner",
  "inputs": [
   {
    "name": "owner",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "OwnableUnauthorizedAccount",
  "inputs": [
   {
    "name": "account",
    "type": "address",
    "internalType": "address"
   }
  ]
 },
 {
  "type": "error",
  "name": "PolicyNotActive",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ProductInactive",
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
  "name": "Soulbound",
  "inputs": []
 },
 {
  "type": "error",
  "name": "TooManyClaims",
  "inputs": []
 },
 {
  "type": "error",
  "name": "UnknownProduct",
  "inputs": []
 },
 {
  "type": "error",
  "name": "ZeroAddress",
  "inputs": []
 }
] as const;
