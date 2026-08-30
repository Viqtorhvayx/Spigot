// Live on the Maculatus testnet — see ../README.md
const CONTRACT_ADDRESS = '0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F';

const X1_TESTNET = {
  chainId: '0x2A1A', // 10778 in hex
  chainName: 'X1 EcoChain — Maculatus Testnet',
  nativeCurrency: { name: 'X1 Testnet Token', symbol: 'X1T', decimals: 18 },
  rpcUrls: ['https://maculatus-rpc.x1eco.com/'],
  blockExplorerUrls: ['https://maculatus-scan.x1eco.com/'],
};

const FAUCET_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function claim()',
  'function timeUntilNextClaim(address) view returns (uint256)',
  'function claimAmount() view returns (uint256)',
];

let account = null;

const log = (msg) => {
  const el = document.getElementById('log');
  el.textContent += `${msg}\n`;
};

const getProvider = () => {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
  return new ethers.BrowserProvider(window.ethereum);
};

const formatCooldown = (seconds) => {
  if (seconds <= 0) return 'ready now';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
};

async function refreshStatus() {
  if (!account) return;
  try {
    const provider = getProvider();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, FAUCET_ABI, provider);
    const [symbol, decimals, balance, remaining] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.balanceOf(account),
      contract.timeUntilNextClaim(account),
    ]);
    document.getElementById('balance').textContent = ethers.formatUnits(balance, decimals);
    const remainingSeconds = Number(remaining);
    document.getElementById('cooldownStatus').textContent = formatCooldown(remainingSeconds);
    document.getElementById('claimBtn').disabled = remainingSeconds > 0;
    log(`Refreshed: ${ethers.formatUnits(balance, decimals)} ${symbol}, next claim in ${formatCooldown(remainingSeconds)}`);
  } catch (err) {
    log(`Error: ${err.message}`);
  }
}

document.getElementById('connectBtn').addEventListener('click', async () => {
  try {
    const provider = getProvider();
    const accounts = await provider.send('eth_requestAccounts', []);
    account = accounts[0];
    document.getElementById('account').textContent = account;
    log(`Connected: ${account}`);
    await refreshStatus();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('addNetworkBtn').addEventListener('click', async () => {
  try {
    if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [X1_TESTNET],
    });
    log('X1 EcoChain testnet added to wallet.');
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('claimBtn').addEventListener('click', async () => {
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, FAUCET_ABI, signer);
    const tx = await contract.claim();
    log(`Submitted claim tx: ${tx.hash}`);
    await tx.wait();
    log('Claim confirmed.');
    await refreshStatus();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});
