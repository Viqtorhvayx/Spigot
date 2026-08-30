// Live on the Maculatus testnet — see ../README.md
const CONTRACT_ADDRESS = '0xB0C1F54c8E87Ef003794cB40Afac43A384d32eb7';
const DEPLOY_BLOCK = 10240377;

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
  'function withdraw() external',
  'function pendingWithdrawals(address) view returns (uint256)',
  'function creators(address) view returns (string name, string bio, uint256 registeredAt, uint256 totalReceived, uint256 tipCount)',
  'function getCreators() view returns (address[])',
  'function creatorCount() view returns (uint256)',
  'event TipSent(address indexed from, address indexed to, uint256 payout, uint256 fee, string message, uint256 timestamp)',
];

let account = null;
let pendingTipTarget = null;
let nameByAddress = {}; // built from the creator list, used to label the activity feed

const params = new URLSearchParams(location.search);
const profileAddress = params.get('creator');

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

const timeAgo = (unixSeconds) => {
  const seconds = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

function renderFeed(container, events, { showTarget }) {
  if (events.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-400 p-5">No tips yet — be the first.</p>';
    return;
  }
  container.innerHTML = events
    .map((e) => {
      const fromLabel = nameByAddress[e.args.from] || shortAddr(e.args.from);
      const toLabel = nameByAddress[e.args.to] || shortAddr(e.args.to);
      const arrow = showTarget ? ` &rarr; <span class="font-medium">${toLabel}</span>` : '';
      const message = e.args.message ? `<div class="text-sm text-slate-500 mt-1">"${e.args.message}"</div>` : '';
      return `
      <div class="p-4">
        <div class="flex items-center justify-between text-sm">
          <span><span class="font-medium">${fromLabel}</span>${arrow} tipped <span class="font-semibold text-emerald-700">${ethers.formatEther(e.args.payout)} X1T</span></span>
          <span class="text-xs text-slate-400">${timeAgo(e.args.timestamp)}</span>
        </div>
        ${message}
      </div>`;
    })
    .join('');
}

async function loadFeed(container, creatorFilterAddress) {
  try {
    const contract = getReadContract();
    const filter = creatorFilterAddress
      ? contract.filters.TipSent(null, creatorFilterAddress)
      : contract.filters.TipSent();
    const events = await contract.queryFilter(filter, DEPLOY_BLOCK, 'latest');
    events.reverse(); // most recent first
    renderFeed(container, events.slice(0, 20), { showTarget: !creatorFilterAddress });
  } catch (err) {
    log(`Error loading activity: ${err.message}`);
  }
}

async function refreshWithdrawWidget() {
  if (!account) return;
  try {
    const contract = getReadContract();
    const pending = await contract.pendingWithdrawals(account);
    const widget = document.getElementById('withdrawWidget');
    if (pending === 0n) {
      widget.classList.add('hidden');
      return;
    }
    widget.classList.remove('hidden');
    document.getElementById('withdrawAmount').textContent = `${ethers.formatEther(pending)} X1T`;
    document.getElementById('withdrawBtn').disabled = false;
  } catch (err) {
    log(`Error checking withdrawable balance: ${err.message}`);
  }
}

async function refreshCreators() {
  try {
    const contract = getReadContract();
    const addresses = await contract.getCreators();
    const grid = document.getElementById('creatorGrid');

    if (addresses.length === 0) {
      grid.innerHTML = '<p class="text-sm text-slate-400 col-span-full">No creators yet — be the first.</p>';
      nameByAddress = {};
      await loadFeed(document.getElementById('activityFeed'), null);
      return;
    }

    const creators = await Promise.all(
      addresses.map(async (addr) => ({ addr, ...(await contract.creators(addr)) }))
    );

    nameByAddress = Object.fromEntries(creators.map((c) => [c.addr, c.name]));

    grid.innerHTML = creators
      .map(
        (c) => `
      <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
        <a href="?creator=${c.addr}" class="flex items-center gap-3 hover:opacity-80 transition">
          <div class="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">${c.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="font-semibold">${c.name}</div>
            <div class="text-xs text-slate-400 font-mono">${shortAddr(c.addr)}</div>
          </div>
        </a>
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

    await loadFeed(document.getElementById('activityFeed'), null);
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
    document.getElementById('myShareLink').value = `${location.origin}${location.pathname}?creator=${account}`;
  } catch (err) {
    log(`Error checking your page: ${err.message}`);
  }
}

async function loadProfile(addr) {
  try {
    document.getElementById('discoverView').classList.add('hidden');
    document.getElementById('profileView').classList.remove('hidden');

    const contract = getReadContract();
    const record = await contract.creators(addr);

    if (!record.name) {
      document.getElementById('profileName').textContent = 'Creator not found';
      document.getElementById('profileBio').textContent = 'No creator is registered at this address.';
      return;
    }

    nameByAddress[addr] = record.name;
    document.getElementById('profileAvatar').textContent = record.name.charAt(0).toUpperCase();
    document.getElementById('profileName').textContent = record.name;
    document.getElementById('profileAddr').textContent = addr;
    document.getElementById('profileBio').textContent = record.bio || 'No bio yet.';
    document.getElementById('profileTotal').textContent = `${ethers.formatEther(record.totalReceived)} X1T`;
    document.getElementById('profileTipCount').textContent = record.tipCount.toString();
    document.getElementById('profileTipBtn').addEventListener('click', () => openTipModal(addr, record.name));

    await loadFeed(document.getElementById('profileFeed'), addr);
  } catch (err) {
    log(`Error loading profile: ${err.message}`);
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
    await refreshWithdrawWidget();
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

document.getElementById('copyShareLinkBtn').addEventListener('click', () => {
  const input = document.getElementById('myShareLink');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => log('Share link copied.'));
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.withdraw();
    log(`Submitted withdraw tx: ${tx.hash}`);
    await tx.wait();
    log('Withdrawal confirmed.');
    await refreshWithdrawWidget();
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
    if (profileAddress) {
      await loadProfile(profileAddress);
    } else {
      await refreshCreators();
    }
    await refreshMyStats();
    await refreshWithdrawWidget();
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('refreshBtn').addEventListener('click', refreshCreators);

if (profileAddress) {
  loadProfile(profileAddress);
} else {
  refreshCreators();
}
