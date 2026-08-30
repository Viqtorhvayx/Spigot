// Spigot — X1 EcoChain (Maculatus testnet) contract config.
const CONTRACT_ADDRESS = '0xf4b3191C7a3315F0d2B375162E3025E78B25B595';
const DEPLOY_BLOCK = 10248541;

const X1_CHAIN_ID_HEX = '0x2a1a'; // 10778
const X1_CHAIN_ID_DEC = 10778;
const X1_RPC_URL = 'https://maculatus-rpc.x1eco.com/';
const X1_EXPLORER_URL = 'https://maculatus-scan.x1eco.com/';

const X1_NETWORK_PARAMS = {
  chainId: X1_CHAIN_ID_HEX,
  chainName: 'X1 EcoChain (Maculatus Testnet)',
  nativeCurrency: { name: 'X1T', symbol: 'X1T', decimals: 18 },
  rpcUrls: [X1_RPC_URL],
  blockExplorerUrls: [X1_EXPLORER_URL],
};

const METERLY_ABI = [
  { "inputs": [{ "internalType": "address", "name": "_feeRecipient", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "DailyLimitReached", "type": "error" },
  { "inputs": [], "name": "DescriptionTooLong", "type": "error" },
  { "inputs": [], "name": "IncorrectPayment", "type": "error" },
  { "inputs": [], "name": "InsufficientCredit", "type": "error" },
  { "inputs": [], "name": "InvalidFeeRecipient", "type": "error" },
  { "inputs": [], "name": "InvalidPrice", "type": "error" },
  { "inputs": [], "name": "NameRequired", "type": "error" },
  { "inputs": [], "name": "NameTooLong", "type": "error" },
  { "inputs": [], "name": "NotServiceProvider", "type": "error" },
  { "inputs": [], "name": "NothingToDeposit", "type": "error" },
  { "inputs": [], "name": "NothingToWithdraw", "type": "error" },
  { "inputs": [], "name": "ReentrancyBlocked", "type": "error" },
  { "inputs": [], "name": "ServiceInactive", "type": "error" },
  { "inputs": [], "name": "ServiceNotFound", "type": "error" },
  { "inputs": [], "name": "TransferFailed", "type": "error" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "receiptId", "type": "uint256" }, { "indexed": true, "internalType": "uint256", "name": "serviceId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "consumer", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "payout", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "CallSettled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "consumer", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "CreditDeposited", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "consumer", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "CreditWithdrawn", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": false, "internalType": "string", "name": "name", "type": "string" }], "name": "DisplayNameSet", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "serviceId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "provider", "type": "address" }, { "indexed": false, "internalType": "string", "name": "name", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }], "name": "ServiceRegistered", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "serviceId", "type": "uint256" }, { "indexed": false, "internalType": "string", "name": "name", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }, { "indexed": false, "internalType": "bool", "name": "active", "type": "bool" }], "name": "ServiceUpdated", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "account", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "Withdrawn", "type": "event" },
  { "inputs": [], "name": "MAX_DESC_LENGTH", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "MAX_NAME_LENGTH", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "PLATFORM_FEE_BPS", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "serviceId", "type": "uint256" }], "name": "callService", "outputs": [{ "internalType": "uint256", "name": "receiptId", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }], "name": "callsInEpoch", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "consumerBalance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "depositCredit", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "displayNames", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "feeRecipient", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "serviceId", "type": "uint256" }], "name": "payAndCall", "outputs": [{ "internalType": "uint256", "name": "receiptId", "type": "uint256" }], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "pendingWithdrawals", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }, { "internalType": "uint256", "name": "maxCallsPerDay", "type": "uint256" }], "name": "registerService", "outputs": [{ "internalType": "uint256", "name": "serviceId", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "services", "outputs": [{ "internalType": "address", "name": "provider", "type": "address" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }, { "internalType": "uint256", "name": "maxCallsPerDay", "type": "uint256" }, { "internalType": "uint256", "name": "registeredAt", "type": "uint256" }, { "internalType": "uint256", "name": "totalCalls", "type": "uint256" }, { "internalType": "uint256", "name": "totalRevenue", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "name", "type": "string" }], "name": "setDisplayName", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "totalCallsSettled", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "totalServices", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "serviceId", "type": "uint256" }, { "internalType": "string", "name": "name", "type": "string" }, { "internalType": "string", "name": "description", "type": "string" }, { "internalType": "uint256", "name": "pricePerCall", "type": "uint256" }, { "internalType": "uint256", "name": "maxCallsPerDay", "type": "uint256" }, { "internalType": "bool", "name": "active", "type": "bool" }], "name": "updateService", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "withdraw", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "withdrawCredit", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];
