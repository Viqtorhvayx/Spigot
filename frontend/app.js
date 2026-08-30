// Live on the Maculatus testnet — see ../README.md
const CONTRACT_ADDRESS = '0xE46141f72321163F3F35aF86cebA6693519e9cCE';
const DEPLOY_BLOCK = 10242615;

const X1_TESTNET = {
  chainId: '0x2A1A', // 10778 in hex
  chainName: 'X1 EcoChain — Maculatus Testnet',
  nativeCurrency: { name: 'X1 Testnet Token', symbol: 'X1T', decimals: 18 },
  rpcUrls: ['https://maculatus-rpc.x1eco.com/'],
  blockExplorerUrls: ['https://maculatus-scan.x1eco.com/'],
};

const ABI = [
  'function registerCreator(string name, string bio) external',
  'function updateProfile(string name, string bio) external',
  'function setDisplayName(string name) external',
  'function setGoal(uint256 target, string description) external',
  'function follow(address creator) external',
  'function unfollow(address creator) external',
  'function tip(address creator, string message) external payable returns (uint256)',
  'function replyToTip(uint256 tipId, string reply) external',
  'function withdraw() external',
  'function pendingWithdrawals(address) view returns (uint256)',
  'function creators(address) view returns (string name, string bio, uint256 registeredAt, uint256 totalReceived, uint256 tipCount, uint256 followerCount, uint256 goalTarget, string goalDescription)',
  'function getCreators() view returns (address[])',
  'function creatorCount() view returns (uint256)',
  'function displayNames(address) view returns (string)',
  'function isFollowing(address, address) view returns (bool)',
  'function tipReplies(uint256) view returns (string)',
  'function tipRecipient(uint256) view returns (address)',
  'event TipSent(uint256 indexed tipId, address indexed from, address indexed to, uint256 payout, uint256 fee, string message, uint256 timestamp)',
  'event TipReplied(uint256 indexed tipId, address indexed creator, string reply, uint256 timestamp)',
];

// A small, deliberately chosen palette — every address gets a stable color
// from this set rather than a single flat brand color everywhere.
const AVATAR_PALETTE = [
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
];

let account = null;
let pendingTipTarget = null;
let nameByAddress = {}; // built from the creator list, used to label the activity feed
let allCreators = []; // cached so search/sort can re-render without refetching

const params = new URLSearchParams(location.search);
const profileAddress = params.get('creator');

// ---------- small UI helpers ----------

function toast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const colors = {
    info: 'bg-slate-900 text-white',
    success: 'bg-emerald-500 text-white',
    error: 'bg-red-500 text-white',
  };
  const el = document.createElement('div');
  el.className = `toast ${colors[type]} px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-4px)';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

const log = (msg) => {
  const el = document.getElementById('log');
  el.textContent += `${msg}\n`;
  el.scrollTop = el.scrollHeight;
};

function wireCounter(inputId, countId) {
  const input = document.getElementById(inputId);
  const count = document.getElementById(countId);
  if (!input || !count) return;
  input.addEventListener('input', () => {
    count.textContent = input.value.length;
  });
}

const getProvider = () => {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
  return new ethers.BrowserProvider(window.ethereum);
};

const getReadContract = () => {
  const readProvider = new ethers.JsonRpcProvider(X1_TESTNET.rpcUrls[0]);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, readProvider);
};

const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const avatarColor = (addr) => AVATAR_PALETTE[parseInt(addr.slice(2, 4), 16) % AVATAR_PALETTE.length];

const timeAgo = (unixSeconds) => {
  const seconds = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

// ---------- rendering ----------

// Fills in nameByAddress for any addresses not already known (creators are
// pre-loaded; this covers fans who've set a display name).
async function resolveNames(addresses) {
  const contract = getReadContract();
  const unknown = [...new Set(addresses)].filter((a) => !(a in nameByAddress));
  if (unknown.length === 0) return;
  const names = await Promise.all(unknown.map((a) => contract.displayNames(a)));
  unknown.forEach((addr, i) => {
    if (names[i]) nameByAddress[addr] = names[i];
  });
}

function renderFeed(container, events, { showTarget, allowReply }) {
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
      const reply = e.reply
        ? `<div class="text-sm bg-emerald-50 text-emerald-800 rounded-lg px-3 py-2 mt-2">↳ ${e.reply}</div>`
        : allowReply
        ? `<div class="mt-2 flex gap-2">
             <input data-tipid="${e.args.tipId}" class="replyInput flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400" placeholder="Reply publicly…" maxlength="280" />
             <button data-tipid="${e.args.tipId}" class="replyBtn text-xs font-medium px-2 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition">Reply</button>
           </div>`
        : '';
      return `
      <div class="p-4">
        <div class="flex items-center justify-between text-sm">
          <span><span class="font-medium">${fromLabel}</span>${arrow} tipped <span class="font-semibold text-emerald-700">${ethers.formatEther(e.args.payout)} X1T</span></span>
          <span class="text-xs text-slate-400">${timeAgo(e.args.timestamp)}</span>
        </div>
        ${message}
        ${reply}
      </div>`;
    })
    .join('');

  if (allowReply) {
    document.querySelectorAll('.replyBtn').forEach((btn) =>
      btn.addEventListener('click', () => submitReply(btn.dataset.tipid, container, events, { showTarget, allowReply }))
    );
  }
}

async function submitReply(tipId, container, events, renderOpts) {
  const input = document.querySelector(`.replyInput[data-tipid="${tipId}"]`);
  const reply = input.value.trim();
  if (!reply) {
    toast('Enter a reply first.', 'error');
    return;
  }
  try {
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.replyToTip(tipId, reply);
    log(`replyToTip tx: ${tx.hash}`);
    await tx.wait();
    toast('Reply posted.', 'success');
    const event = events.find((e) => e.args.tipId.toString() === tipId);
    if (event) event.reply = reply;
    renderFeed(container, events, renderOpts);
  } catch (err) {
    toast(err.reason || err.message, 'error');
  }
}

async function loadFeed(container, creatorFilterAddress, { allowReply = false } = {}) {
  try {
    const contract = getReadContract();
    const filter = creatorFilterAddress
      ? contract.filters.TipSent(null, null, creatorFilterAddress)
      : contract.filters.TipSent();
    const events = await contract.queryFilter(filter, DEPLOY_BLOCK, 'latest');
    events.reverse(); // most recent first
    const shown = events.slice(0, 20);

    await resolveNames(shown.flatMap((e) => [e.args.from, e.args.to]));

    const replies = await Promise.all(shown.map((e) => contract.tipReplies(e.args.tipId)));
    shown.forEach((e, i) => {
      if (replies[i]) e.reply = replies[i];
    });

    renderFeed(container, shown, { showTarget: !creatorFilterAddress, allowReply });
    return events;
  } catch (err) {
    toast(`Error loading activity: ${err.message}`, 'error');
    return [];
  }
}

function renderTopSupporters(container, section, events) {
  if (events.length === 0) {
    section.classList.add('hidden');
    return;
  }

  const totals = new Map();
  for (const e of events) {
    totals.set(e.args.from, (totals.get(e.args.from) || 0n) + e.args.payout);
  }
  const ranked = [...totals.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1)).slice(0, 5);

  section.classList.remove('hidden');
  container.innerHTML = ranked
    .map(([addr, total], i) => {
      const label = nameByAddress[addr] || shortAddr(addr);
      return `
      <div class="p-4 flex items-center justify-between text-sm">
        <span><span class="text-slate-400 font-mono mr-2">#${i + 1}</span><span class="font-medium">${label}</span></span>
        <span class="font-semibold text-emerald-700">${ethers.formatEther(total)} X1T</span>
      </div>`;
    })
    .join('');
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

function renderCreatorGrid() {
  const grid = document.getElementById('creatorGrid');
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const sortBy = document.getElementById('sortSelect').value;

  let list = allCreators.filter((c) => c.name.toLowerCase().includes(query));

  if (sortBy === 'top') {
    list = [...list].sort((a, b) => (b.totalReceived > a.totalReceived ? 1 : -1));
  } else if (sortBy === 'tips') {
    list = [...list].sort((a, b) => Number(b.tipCount) - Number(a.tipCount));
  } else if (sortBy === 'newest') {
    list = [...list].sort((a, b) => Number(b.registeredAt) - Number(a.registeredAt));
  }

  if (list.length === 0) {
    grid.innerHTML = `<p class="text-sm text-slate-400 col-span-full">${
      allCreators.length === 0 ? 'No creators yet — be the first.' : 'No creators match your search.'
    }</p>`;
    return;
  }

  grid.innerHTML = list
    .map(
      (c) => `
    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col">
      <a href="?creator=${c.addr}" class="flex items-center gap-3 hover:opacity-80 transition">
        <div class="w-10 h-10 rounded-full ${avatarColor(c.addr)} flex items-center justify-center font-bold">${c.name.charAt(0).toUpperCase()}</div>
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
}

async function refreshCreators() {
  try {
    const contract = getReadContract();
    const addresses = await contract.getCreators();

    if (addresses.length === 0) {
      allCreators = [];
      nameByAddress = {};
      renderCreatorGrid();
      await loadFeed(document.getElementById('activityFeed'), null);
      return;
    }

    allCreators = await Promise.all(
      addresses.map(async (addr) => {
        // ethers v6 Result objects don't expose named fields via spread —
        // only numeric indices — so pull each field out explicitly.
        const c = await contract.creators(addr);
        return {
          addr,
          name: c.name,
          bio: c.bio,
          registeredAt: c.registeredAt,
          totalReceived: c.totalReceived,
          tipCount: c.tipCount,
        };
      })
    );

    nameByAddress = Object.fromEntries(allCreators.map((c) => [c.addr, c.name]));
    renderCreatorGrid();

    await loadFeed(document.getElementById('activityFeed'), null);
  } catch (err) {
    toast(`Error loading creators: ${err.message}`, 'error');
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
    document.getElementById('editNameInput').value = record.name;
    document.getElementById('editBioInput').value = record.bio;
    document.getElementById('editNameCount').textContent = record.name.length;
    document.getElementById('editBioCount').textContent = record.bio.length;

    if (record.goalTarget > 0n) {
      document.getElementById('myGoalSummary').textContent =
        `${ethers.formatEther(record.totalReceived)} / ${ethers.formatEther(record.goalTarget)} X1T — ${record.goalDescription}`;
      document.getElementById('goalTargetInput').value = ethers.formatEther(record.goalTarget);
      document.getElementById('goalDescInput').value = record.goalDescription;
    } else {
      document.getElementById('myGoalSummary').textContent = 'No goal set.';
    }
  } catch (err) {
    toast(`Error checking your page: ${err.message}`, 'error');
  }
}

async function refreshDisplayNameWidget() {
  if (!account) return;
  try {
    const contract = getReadContract();
    const name = await contract.displayNames(account);
    document.getElementById('displayNameWidget').classList.remove('hidden');
    document.getElementById('currentDisplayName').textContent = name || 'not set';
    document.getElementById('displayNameInput').value = name;
  } catch (err) {
    log(`Error checking display name: ${err.message}`);
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
    document.title = `${record.name} — Tipstream`;

    const avatar = document.getElementById('profileAvatar');
    avatar.className = `w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl mx-auto ${avatarColor(addr)}`;
    avatar.textContent = record.name.charAt(0).toUpperCase();
    document.getElementById('profileName').textContent = record.name;
    document.getElementById('profileAddr').textContent = addr;
    document.getElementById('profileFollowerCount').textContent = record.followerCount.toString();
    document.getElementById('profileBio').textContent = record.bio || 'No bio yet.';
    document.getElementById('profileTotal').textContent = `${ethers.formatEther(record.totalReceived)} X1T`;
    document.getElementById('profileTipCount').textContent = record.tipCount.toString();
    document.getElementById('profileTipBtn').replaceWith(document.getElementById('profileTipBtn').cloneNode(true));
    document.getElementById('profileTipBtn').addEventListener('click', () => openTipModal(addr, record.name));

    const goalSection = document.getElementById('goalSection');
    if (record.goalTarget > 0n) {
      goalSection.classList.remove('hidden');
      const pct = Math.min(100, Number((record.totalReceived * 100n) / record.goalTarget));
      document.getElementById('goalDescText').textContent = record.goalDescription || 'Funding goal';
      document.getElementById('goalProgressText').textContent =
        `${ethers.formatEther(record.totalReceived)} / ${ethers.formatEther(record.goalTarget)} X1T (${pct}%)`;
      document.getElementById('goalProgressBar').style.width = `${pct}%`;
    } else {
      goalSection.classList.add('hidden');
    }

    const followBtn = document.getElementById('profileFollowBtn');
    const isOwnProfile = account && account.toLowerCase() === addr.toLowerCase();
    if (account && !isOwnProfile) {
      followBtn.classList.remove('hidden');
      const following = await contract.isFollowing(account, addr);
      setFollowButtonState(followBtn, following, addr);
    } else {
      followBtn.classList.add('hidden');
    }

    const events = await loadFeed(document.getElementById('profileFeed'), addr, { allowReply: isOwnProfile });
    renderTopSupporters(
      document.getElementById('topSupporters'),
      document.getElementById('topSupportersSection'),
      events
    );
  } catch (err) {
    toast(`Error loading profile: ${err.message}`, 'error');
  }
}

function setFollowButtonState(btn, following, creatorAddr) {
  btn.textContent = following ? 'Following' : 'Follow';
  btn.className = following
    ? 'text-sm font-medium px-6 py-3 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition'
    : 'text-sm font-medium px-6 py-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition';
  btn.replaceWith(btn.cloneNode(true));
  const fresh = document.getElementById('profileFollowBtn');
  fresh.addEventListener('click', async () => {
    const original = fresh.textContent;
    try {
      if (!account) throw new Error('Connect your wallet first.');
      fresh.disabled = true;
      fresh.innerHTML = '<span class="spinner"></span>' + (following ? 'Unfollowing…' : 'Following…');
      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      const tx = following ? await contract.unfollow(creatorAddr) : await contract.follow(creatorAddr);
      log(`${following ? 'unfollow' : 'follow'} tx: ${tx.hash}`);
      await tx.wait();
      toast(following ? 'Unfollowed.' : 'Now following!', 'success');
      await loadProfile(creatorAddr);
    } catch (err) {
      toast(err.reason || err.message, 'error');
      fresh.disabled = false;
      fresh.textContent = original;
    }
  });
}

function openTipModal(addr, name) {
  pendingTipTarget = addr;
  document.getElementById('tipModalName').textContent = name;
  document.getElementById('tipAmount').value = '';
  document.getElementById('tipMessage').value = '';
  document.getElementById('tipMessageCount').textContent = '0';
  document.getElementById('tipModal').classList.remove('hidden');
}

function closeTipModal() {
  pendingTipTarget = null;
  document.getElementById('tipModal').classList.add('hidden');
}

// ---------- event wiring ----------

document.getElementById('connectBtn').addEventListener('click', async () => {
  const btn = document.getElementById('connectBtn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Connecting…';
  try {
    const provider = getProvider();
    const accounts = await provider.send('eth_requestAccounts', []);
    account = accounts[0];
    document.getElementById('account').textContent = account;
    toast('Wallet connected.', 'success');
    await refreshMyStats();
    await refreshWithdrawWidget();
    await refreshDisplayNameWidget();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('addNetworkBtn').addEventListener('click', async () => {
  try {
    if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
    await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [X1_TESTNET] });
    toast('X1 EcoChain testnet added to wallet.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

wireCounter('nameInput', 'nameCount');
wireCounter('bioInput', 'bioCount');
wireCounter('editNameInput', 'editNameCount');
wireCounter('editBioInput', 'editBioCount');
wireCounter('tipMessage', 'tipMessageCount');

document.getElementById('editDisplayNameToggle').addEventListener('click', () => {
  document.getElementById('displayNameForm').classList.toggle('hidden');
});

document.getElementById('saveDisplayNameBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveDisplayNameBtn');
  const original = btn.textContent;
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const name = document.getElementById('displayNameInput').value.trim();
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving…';
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.setDisplayName(name);
    log(`setDisplayName tx: ${tx.hash}`);
    await tx.wait();
    toast('Display name saved.', 'success');
    document.getElementById('displayNameForm').classList.add('hidden');
    await refreshDisplayNameWidget();
  } catch (err) {
    toast(err.reason || err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('editGoalToggle').addEventListener('click', () => {
  document.getElementById('editGoalForm').classList.toggle('hidden');
});

document.getElementById('saveGoalBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveGoalBtn');
  const original = btn.textContent;
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const target = document.getElementById('goalTargetInput').value.trim();
    const desc = document.getElementById('goalDescInput').value.trim();
    if (!target || Number(target) < 0) throw new Error('Enter a valid target amount (0 clears the goal).');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving…';
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.setGoal(ethers.parseEther(target), desc);
    log(`setGoal tx: ${tx.hash}`);
    await tx.wait();
    toast('Goal saved.', 'success');
    document.getElementById('editGoalForm').classList.add('hidden');
    await refreshMyStats();
  } catch (err) {
    toast(err.reason || err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('registerBtn').addEventListener('click', async () => {
  const btn = document.getElementById('registerBtn');
  const original = btn.textContent;
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const name = document.getElementById('nameInput').value.trim();
    const bio = document.getElementById('bioInput').value.trim();
    if (!name) throw new Error('Enter a name.');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Creating…';
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.registerCreator(name, bio);
    log(`registerCreator tx: ${tx.hash}`);
    await tx.wait();
    toast('Your page is live!', 'success');
    await refreshMyStats();
    await refreshCreators();
  } catch (err) {
    toast(err.reason || err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('editProfileToggle').addEventListener('click', () => {
  document.getElementById('editProfileForm').classList.toggle('hidden');
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const btn = document.getElementById('saveProfileBtn');
  const original = btn.textContent;
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const name = document.getElementById('editNameInput').value.trim();
    const bio = document.getElementById('editBioInput').value.trim();
    if (!name) throw new Error('Name cannot be empty.');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Saving…';
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.updateProfile(name, bio);
    log(`updateProfile tx: ${tx.hash}`);
    await tx.wait();
    toast('Profile updated.', 'success');
    document.getElementById('editProfileForm').classList.add('hidden');
    await refreshMyStats();
    await refreshCreators();
  } catch (err) {
    toast(err.reason || err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('copyShareLinkBtn').addEventListener('click', () => {
  const input = document.getElementById('myShareLink');
  input.select();
  navigator.clipboard.writeText(input.value).then(() => toast('Share link copied.', 'success'));
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
  const btn = document.getElementById('withdrawBtn');
  const original = btn.textContent;
  try {
    if (!account) throw new Error('Connect your wallet first.');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Withdrawing…';
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.withdraw();
    log(`withdraw tx: ${tx.hash}`);
    await tx.wait();
    toast('Withdrawal confirmed.', 'success');
    await refreshWithdrawWidget();
  } catch (err) {
    toast(err.reason || err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('tipCancelBtn').addEventListener('click', closeTipModal);

document.getElementById('tipSendBtn').addEventListener('click', async () => {
  const btn = document.getElementById('tipSendBtn');
  const original = btn.textContent;
  try {
    if (!account) throw new Error('Connect your wallet first.');
    const amount = document.getElementById('tipAmount').value.trim();
    const message = document.getElementById('tipMessage').value.trim();
    if (!amount || Number(amount) <= 0) throw new Error('Enter a tip amount.');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Sending…';
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    const tx = await contract.tip(pendingTipTarget, message, { value: ethers.parseEther(amount) });
    log(`tip tx: ${tx.hash}`);
    closeTipModal();
    await tx.wait();
    toast('Tip sent!', 'success');
    if (profileAddress) {
      await loadProfile(profileAddress);
    } else {
      await refreshCreators();
    }
    await refreshMyStats();
    await refreshWithdrawWidget();
  } catch (err) {
    toast(err.reason || err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

document.getElementById('refreshBtn').addEventListener('click', refreshCreators);
document.getElementById('searchInput').addEventListener('input', renderCreatorGrid);
document.getElementById('sortSelect').addEventListener('change', renderCreatorGrid);

document.querySelectorAll('.quickAmountBtn').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.getElementById('tipAmount').value = btn.dataset.amount;
  })
);

if (profileAddress) {
  loadProfile(profileAddress);
} else {
  refreshCreators();
}
