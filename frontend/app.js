// Live on the Maculatus testnet — see ../README.md
const CONTRACT_ADDRESS = '0xC76bC2E969803C059888218DB532DEa9B63a8D8E';

const X1_TESTNET = {
  chainId: '0x2A1A', // 10778 in hex
  chainName: 'X1 EcoChain — Maculatus Testnet',
  nativeCurrency: { name: 'X1 Testnet Token', symbol: 'X1T', decimals: 18 },
  rpcUrls: ['https://maculatus-rpc.x1eco.com/'],
  blockExplorerUrls: ['https://maculatus-scan.x1eco.com/'],
};

const ABI = [
  'function registerNode(string label) external',
  'function heartbeat() external',
  'function nodes(address) view returns (string label, uint256 registeredAt, uint256 lastHeartbeat, uint256 heartbeatCount)',
  'function isActive(address) view returns (bool)',
  'function operatorCount() view returns (uint256)',
  'function getOperators() view returns (address[])',
  'function MIN_INTERVAL() view returns (uint256)',
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

const getReadContract = () => {
  const readProvider = new ethers.JsonRpcProvider(X1_TESTNET.rpcUrls[0]);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
};

const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const timeAgo = (unixSeconds) => {
  if (unixSeconds === 0n) return 'never';
  const seconds = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

async function refreshNetwork() {
  try {
    const contract = getReadContract();
    const operators = await contract.getOperators();
    document.getElementById('operatorCount').textContent = operators.length;

    const rows = await Promise.all(
      operators.map(async (addr) => {
        const [node, active] = await Promise.all([contract.nodes(addr), contract.isActive(addr)]);
        return { addr, ...node, active };
      })
    );

    const tbody = document.getElementById('operatorsTable');
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td><span class="dot ${r.active ? 'active' : 'inactive'}"></span>${r.active ? 'Active' : 'Inactive'}</td>
        <td>${r.label}</td>
        <td>${shortAddr(r.addr)}</td>
        <td>${r.heartbeatCount}</td>
        <td>${timeAgo(r.lastHeartbeat)}</td>
      </tr>`
      )
      .join('');
  } catch (err) {
    log(`Error refreshing network: ${err.message}`);
  }
}

async function refreshMyStatus() {
  if (!account) return;
  try {
    const contract = getReadContract();
    const node = await contract.nodes(account);
    const minInterval = await contract.MIN_INTERVAL();

    if (node.registeredAt === 0n) {
      document.getElementById('myStatus').textContent = 'Not registered yet.';
      document.getElementById('registerSection').style.display = 'block';
      document.getElementById('heartbeatBtn').disabled = true;
      return;
    }

    document.getElementById('registerSection').style.display = 'none';
    const active = await contract.isActive(account);
    const nextEligible = node.lastHeartbeat + minInterval;
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const canHeartbeatNow = nowSec >= nextEligible;

    document.getElementById('myStatus').textContent =
      `Registered as "${node.label}" — ${node.heartbeatCount} heartbeat(s), ` +
      `${active ? 'currently active' : 'inactive'}, last seen ${timeAgo(node.lastHeartbeat)}.`;
    document.getElementById('heartbeatBtn').disabled = !canHeartbeatNow;
  } catch (err) {
    log(`Error checking status: ${err.message}`);
  }
}

document.getElementById('connectBtn').addEventListener('click', async () => {
  try {
    const provider = getProvider();
    const accounts = await provider.send('eth_requestAccounts', []);
    account = accounts[0];
    document.getElementById('account').textContent = account;
    log(`Connected: ${account}`);
    await refreshMyStatus();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('addNetworkBtn').addEventListener('click', async () => {
  try {
    if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [X1_TESTNET] });
    log('X1 EcoChain testnet added to wallet.');
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('registerBtn').addEventListener('click', async () => {
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const label = document.getElementById('labelInput').value.trim();
    if (!label) throw new Error('Enter a node label.');
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.registerNode(label);
    log(`Submitted registerNode tx: ${tx.hash}`);
    await tx.wait();
    log('Registered.');
    await refreshMyStatus();
    await refreshNetwork();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('heartbeatBtn').addEventListener('click', async () => {
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.heartbeat();
    log(`Submitted heartbeat tx: ${tx.hash}`);
    await tx.wait();
    log('Heartbeat confirmed.');
    await refreshMyStatus();
    await refreshNetwork();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('refreshBtn').addEventListener('click', refreshNetwork);

refreshNetwork();
