// Live on the Maculatus testnet — see ../README.md
const CONTRACT_ADDRESS = '0x634fC0f2613AB092aAA6f6cFF4b42f49F5eD32aF';

const X1_TESTNET = {
  chainId: '0x2A1A', // 10778 in hex
  chainName: 'X1 EcoChain — Maculatus Testnet',
  nativeCurrency: { name: 'X1 Testnet Token', symbol: 'X1T', decimals: 18 },
  rpcUrls: ['https://maculatus-rpc.x1eco.com/'],
  blockExplorerUrls: ['https://maculatus-scan.x1eco.com/'],
};

const ABI = [
  'function registerCreator(string name, string bio) external',
  'function tip(address creator, string message) external payable',
  'function creators(address) view returns (string name, string bio, uint256 registeredAt, uint256 totalReceived, uint256 tipCount)',
  'function getCreators() view returns (address[])',
  'function creatorCount() view returns (uint256)',
  'function PLATFORM_FEE_BPS() view returns (uint256)',
];

let account = null;
let pendingTipTarget = null;

const log = (msg) => {
  document.getElementById('log').textContent += `${msg}\n`;
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

async function refreshCreators() {
  try {
    const contract = getReadContract();
    const addresses = await contract.getCreators();
    const grid = document.getElementById('creatorGrid');

    if (addresses.length === 0) {
      grid.innerHTML = '<p class="text-sm text-slate-400 col-span-full">No creators yet — be the first.</p>';
      return;
    }

    const creators = await Promise.all(
      addresses.map(async (addr) => ({ addr, ...(await contract.creators(addr)) }))
    );

    grid.innerHTML = creators
      .map(
        (c) => `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">${c.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="font-semibold">${c.name}</div>
            <div class="text-xs text-slate-400 font-mono">${shortAddr(c.addr)}</div>
          </div>
        </div>
        <p class="text-sm text-slate-500 mt-3 flex-1">${c.bio || 'No bio yet.'}</p>
        <div class="flex items-center justify-between mt-4 text-sm">
          <span class="text-slate-500">${ethers.formatEther(c.totalReceived)} X1T · ${c.tipCount} tip(s)</span>
          <button data-addr="${c.addr}" data-name="${c.name}" class="tipBtn text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition">Tip</button>
        </div>
      </div>`
      )
      .join('');

    document.querySelectorAll('.tipBtn').forEach((btn) =>
      btn.addEventListener('click', () => openTipModal(btn.dataset.addr, btn.dataset.name))
    );
  } catch (err) {
    log(`Error loading creators: ${err.message}`);
  }
}

async function refreshMyStats() {
  if (!account) return;
  try {
    const contract = getReadContract();
    const record = await contract.creators(account);

    if (!record.name) {
      document.getElementById('registerView').classList.remove('hidden');
      document.getElementById('myStatsView').classList.add('hidden');
      return;
    }

    document.getElementById('registerView').classList.add('hidden');
    document.getElementById('myStatsView').classList.remove('hidden');
    document.getElementById('myTotal').textContent = `${ethers.formatEther(record.totalReceived)} X1T`;
    document.getElementById('myTipCount').textContent = record.tipCount.toString();
  } catch (err) {
    log(`Error checking your page: ${err.message}`);
  }
}

function openTipModal(addr, name) {
  pendingTipTarget = addr;
  document.getElementById('tipModalName').textContent = name;
  document.getElementById('tipAmount').value = '';
  document.getElementById('tipMessage').value = '';
  document.getElementById('tipModal').classList.remove('hidden');
}

function closeTipModal() {
  pendingTipTarget = null;
  document.getElementById('tipModal').classList.add('hidden');
}

document.getElementById('connectBtn').addEventListener('click', async () => {
  try {
    const provider = getProvider();
    const accounts = await provider.send('eth_requestAccounts', []);
    account = accounts[0];
    document.getElementById('account').textContent = account;
    log(`Connected: ${account}`);
    await refreshMyStats();
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
    const name = document.getElementById('nameInput').value.trim();
    const bio = document.getElementById('bioInput').value.trim();
    if (!name) throw new Error('Enter a name.');

    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.registerCreator(name, bio);
    log(`Submitted registerCreator tx: ${tx.hash}`);
    await tx.wait();
    log('Registered.');
    await refreshMyStats();
    await refreshCreators();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('tipCancelBtn').addEventListener('click', closeTipModal);

document.getElementById('tipSendBtn').addEventListener('click', async () => {
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const amount = document.getElementById('tipAmount').value.trim();
    const message = document.getElementById('tipMessage').value.trim();
    if (!amount || Number(amount) <= 0) throw new Error('Enter a tip amount.');

    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.tip(pendingTipTarget, message, { value: ethers.parseEther(amount) });
    log(`Submitted tip tx: ${tx.hash}`);
    closeTipModal();
    await tx.wait();
    log('Tip confirmed.');
    await refreshCreators();
    await refreshMyStats();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('refreshBtn').addEventListener('click', refreshCreators);

refreshCreators();
