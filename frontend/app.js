// Spigot frontend — vanilla JS + ethers v6, no build step.

const readProvider = new ethers.JsonRpcProvider(X1_RPC_URL);
const readContract = new ethers.Contract(CONTRACT_ADDRESS, METERLY_ABI, readProvider);

let browserProvider = null;
let signer = null;
let signerContract = null;
let account = null;

let servicesCache = []; // [{id, provider, name, description, pricePerCall, maxCallsPerDay, registeredAt, totalCalls, totalRevenue, active}]

// ---------- helpers ----------

function short(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

function fmtX1T(wei, maxDecimals = 4) {
  const s = ethers.formatEther(wei);
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
}

function avatarColor(addr) {
  const colors = ['#22d3ee', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15', '#60a5fa', '#f87171'];
  let hash = 0;
  for (let i = 0; i < addr.length; i++) hash = (hash * 31 + addr.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

async function displayNameOr(addr) {
  try {
    const name = await readContract.displayNames(addr);
    return name && name.length ? name : null;
  } catch {
    return null;
  }
}

function avatarHtml(addr, size = 22) {
  return `<span class="inline-block rounded-full" style="width:${size}px;height:${size}px;background:${avatarColor(addr)}"></span>`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(ts) {
  const secs = Math.floor(Date.now() / 1000) - Number(ts);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ---------- toasts ----------

function toast(message, type = 'info') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  const palette = {
    info: 'bg-panel/80 text-slate-200',
    success: 'bg-emerald-500/15 text-emerald-300',
    error: 'bg-rose-500/15 text-rose-300',
  };
  el.className = `toast-enter rounded-xl px-4 py-3 text-sm shadow-lg backdrop-blur-md ${palette[type] || palette.info}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s, transform 0.3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 300);
  }, 4200);
}

function friendlyError(err) {
  const raw = (err && (err.shortMessage || err.reason || err.message)) || 'Transaction failed';
  const knownErrors = [
    'NameRequired', 'NameTooLong', 'DescriptionTooLong', 'InvalidPrice', 'ServiceNotFound',
    'NotServiceProvider', 'ServiceInactive', 'InsufficientCredit', 'IncorrectPayment',
    'DailyLimitReached', 'NothingToWithdraw', 'TransferFailed', 'NothingToDeposit',
  ];
  for (const name of knownErrors) {
    if (raw.includes(name)) return name.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  if (raw.toLowerCase().includes('user rejected') || raw.toLowerCase().includes('user denied')) return 'Rejected in wallet';
  if (raw.toLowerCase().includes('insufficient funds')) return 'Insufficient X1T for this transaction';
  return raw.length > 140 ? raw.slice(0, 140) + '…' : raw;
}

async function runTx(promiseFn, { pending, success, button } = {}) {
  if (button) {
    button.disabled = true;
    button.dataset.originalText = button.dataset.originalText || button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> ${pending || 'Confirming…'}`;
  }
  try {
    const tx = await promiseFn();
    const receipt = await tx.wait();
    toast(success || 'Transaction confirmed', 'success');
    return receipt;
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), 'error');
    throw err;
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText;
    }
  }
}

// ---------- wallet ----------

let wcProvider = null; // the raw WalletConnect EthereumProvider, if that path was used

function renderWalletArea() {
  const el = document.getElementById('walletArea');
  if (!account) {
    el.innerHTML = `
      <div class="relative">
        <button id="connectBtn" class="bg-accent text-ink font-semibold text-sm rounded-lg px-4 py-2 hover:bg-lime-300 transition">Connect Wallet</button>
        <div id="connectMenu" class="hidden absolute right-0 mt-2 w-60 bg-panel border border-border rounded-xl shadow-lg overflow-hidden z-50">
          <button id="connectInjected" class="w-full text-left px-4 py-3 hover:bg-panel2 transition">
            <div class="text-sm font-semibold">Browser Wallet</div>
            <div class="text-xs text-slate-500">MetaMask or another extension</div>
          </button>
          <button id="connectWC" class="w-full text-left px-4 py-3 hover:bg-panel2 transition border-t border-border">
            <div class="text-sm font-semibold">WalletConnect</div>
            <div class="text-xs text-slate-500">Scan a QR with a mobile wallet</div>
          </button>
        </div>
      </div>`;
    const menu = document.getElementById('connectMenu');
    document.getElementById('connectBtn').onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    };
    document.getElementById('connectInjected').onclick = connectWallet;
    document.getElementById('connectWC').onclick = connectWalletConnect;
    document.addEventListener('click', () => menu.classList.add('hidden'), { once: true });
    return;
  }
  el.innerHTML = `
    <div class="relative">
      <button id="walletPill" class="flex items-center gap-2 bg-panel2 border border-border rounded-full pl-1.5 pr-3 py-1 hover:border-accent/40 transition">
        ${avatarHtml(account, 22)}
        <span class="text-sm font-mono" id="walletAddrLabel">${short(account)}</span>
      </button>
      <div id="walletMenu" class="hidden absolute right-0 mt-2 w-44 bg-panel border border-border rounded-xl shadow-lg overflow-hidden z-50">
        <button id="disconnectBtn" class="w-full text-left px-4 py-3 text-sm font-semibold text-rose-400 hover:bg-panel2 transition">Disconnect</button>
      </div>
    </div>`;
  const walletMenu = document.getElementById('walletMenu');
  document.getElementById('walletPill').onclick = (e) => {
    e.stopPropagation();
    walletMenu.classList.toggle('hidden');
  };
  document.getElementById('disconnectBtn').onclick = disconnectWallet;
  document.addEventListener('click', () => walletMenu.classList.add('hidden'), { once: true });
  displayNameOr(account).then((name) => {
    if (name) document.getElementById('walletAddrLabel').textContent = name;
  });
}

// Clears local session state and re-renders. `silent` skips the toast —
// used when disconnectWallet() is about to show its own, so the user
// doesn't see two.
function resetWalletState({ silent = false } = {}) {
  const wasConnected = !!account;
  wcProvider = null;
  browserProvider = null;
  signer = null;
  signerContract = null;
  account = null;
  renderWalletArea();
  refreshAccountPanel();
  refreshMyServices();
  if (wasConnected && !silent) toast('Wallet disconnected', 'info');
}

async function disconnectWallet() {
  const activeWcProvider = wcProvider;
  resetWalletState({ silent: true }); // clear the UI immediately, don't block on the network call below
  if (activeWcProvider) {
    try {
      await activeWcProvider.disconnect(); // tears down the WalletConnect session so the wallet app shows it as disconnected too
    } catch (err) {
      console.error('error tearing down WalletConnect session:', err);
    }
  }
  toast('Wallet disconnected', 'info');
}

// Injected wallet (MetaMask extension, or a mobile wallet's in-app browser).
// Every step below talks to window.ethereum directly and is fully awaited
// before the next one fires — some mobile wallet bridges (Coinbase Wallet,
// MetaMask mobile) throw a "could not coalesce" error when they receive
// overlapping requests, which happens if ethers' own automatic network
// detection races with our explicit calls. Passing a static `network` to
// BrowserProvider below disables that auto-detection entirely.
async function connectWallet() {
  if (!window.ethereum) {
    toast('No browser wallet found — try WalletConnect instead, or install MetaMask', 'error');
    return;
  }
  try {
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    await ensureNetworkInjected();
    browserProvider = new ethers.BrowserProvider(window.ethereum, { chainId: X1_CHAIN_ID_DEC, name: 'x1-maculatus' });
    signer = await browserProvider.getSigner();
    await finishConnect();
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), 'error');
  }
}

async function ensureNetworkInjected() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  if (chainId?.toLowerCase() === X1_CHAIN_ID_HEX) return;
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: X1_CHAIN_ID_HEX }] });
  } catch (switchErr) {
    if (switchErr.code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [X1_NETWORK_PARAMS] });
    } else {
      throw switchErr;
    }
  }
}

// WalletConnect v2 — for visitors on a plain mobile browser with no
// injected wallet at all, connecting by scanning a QR code (or a deep
// link) with a wallet app on their phone. Loaded lazily so a page load
// never pays for it unless someone actually clicks this option.
async function connectWalletConnect() {
  if (!WALLETCONNECT_PROJECT_ID) {
    toast('WalletConnect isn\'t configured on this deployment yet — use a browser wallet for now', 'error');
    return;
  }
  try {
    const { EthereumProvider } = await import('https://esm.sh/@walletconnect/ethereum-provider@2.17.0?bundle');
    wcProvider = await EthereumProvider.init({
      projectId: WALLETCONNECT_PROJECT_ID,
      chains: [X1_CHAIN_ID_DEC],
      optionalChains: [X1_CHAIN_ID_DEC],
      rpcMap: { [X1_CHAIN_ID_DEC]: X1_RPC_URL },
      showQrModal: true,
      metadata: {
        name: 'Spigot',
        description: 'Pay-per-call settlement rails for APIs and AI agents on X1 EcoChain',
        url: window.location.origin,
        icons: [],
      },
    });
    // Fires when the session ends from the wallet app's side (not via our
    // own Disconnect button, which already resets state itself) — e.g. the
    // user disconnects from inside their wallet app.
    wcProvider.on('disconnect', () => resetWalletState());
    await wcProvider.enable();
    browserProvider = new ethers.BrowserProvider(wcProvider, { chainId: X1_CHAIN_ID_DEC, name: 'x1-maculatus' });
    signer = await browserProvider.getSigner();
    await finishConnect();
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), 'error');
  }
}

async function finishConnect() {
  signerContract = new ethers.Contract(CONTRACT_ADDRESS, METERLY_ABI, signer);
  account = await signer.getAddress();
  renderWalletArea();
  refreshAccountPanel();
  refreshMyServices();
  toast('Wallet connected', 'success');
}

if (window.ethereum) {
  window.ethereum.on?.('accountsChanged', () => window.location.reload());
  window.ethereum.on?.('chainChanged', () => window.location.reload());
}

// ---------- tabs ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    const panel = document.getElementById(`tab-${btn.dataset.tab}`);
    panel.classList.remove('hidden');
    panel.classList.add('fade-in');
    if (btn.dataset.tab === 'activity') loadActivity();
  });
});

// ---------- services: load + render ----------

async function loadServices() {
  try {
    const total = Number(await readContract.totalServices());
    const calls = [];
    for (let i = 0; i < total; i++) calls.push(readContract.services(i));
    const raw = await Promise.all(calls);
    servicesCache = raw.map((s, id) => ({
      id,
      provider: s.provider,
      name: s.name,
      description: s.description,
      pricePerCall: s.pricePerCall,
      maxCallsPerDay: s.maxCallsPerDay,
      registeredAt: s.registeredAt,
      totalCalls: s.totalCalls,
      totalRevenue: s.totalRevenue,
      active: s.active,
    }));
    document.getElementById('statServices').textContent = servicesCache.filter((s) => s.active).length;
    const totalCallsSettled = await readContract.totalCallsSettled();
    document.getElementById('statCalls').textContent = totalCallsSettled.toString();
    await renderServiceGrid();
    await renderMyServices();
  } catch (err) {
    console.error(err);
    toast('Could not load services from chain', 'error');
  }
}

async function renderServiceGrid() {
  const grid = document.getElementById('serviceGrid');
  const showInactive = document.getElementById('showInactive').checked;
  const list = servicesCache.filter((s) => showInactive || s.active);
  document.getElementById('serviceEmpty').classList.toggle('hidden', list.length > 0);
  if (!list.length) {
    grid.innerHTML = '';
    return;
  }

  const names = await Promise.all(list.map((s) => displayNameOr(s.provider)));

  grid.innerHTML = list
    .map((s, idx) => {
      const providerLabel = names[idx] || short(s.provider);
      const cap = s.maxCallsPerDay > 0n ? `${s.maxCallsPerDay}/day per caller` : 'no daily cap';
      return `
      <div class="bg-panel border border-border rounded-2xl p-4 flex flex-col gap-3 h-full transition hover:border-accent/40 ${s.active ? '' : 'opacity-50'}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="font-bold truncate">${escapeHtml(s.name)}</div>
            <div class="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              ${avatarHtml(s.provider, 14)} <span class="truncate">${escapeHtml(providerLabel)}</span>
              <button data-copy-address="${s.provider}" class="copyAddrBtn text-slate-600 hover:text-accent transition shrink-0" title="Copy address">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
          </div>
          ${s.active
            ? '<span class="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full shrink-0">ACTIVE</span>'
            : '<span class="text-[10px] font-semibold text-slate-500 bg-slate-500/10 px-2 py-0.5 rounded-full shrink-0">INACTIVE</span>'}
        </div>
        <p class="text-xs text-slate-400 leading-relaxed line-clamp-3">${escapeHtml(s.description)}</p>
        <div class="mt-auto space-y-3">
          <div class="flex items-center justify-between text-xs text-slate-500 border-t border-border pt-3">
            <span>${cap}</span>
            <span>${s.totalCalls.toString()} calls</span>
          </div>
          <div class="flex items-end justify-between">
            <div class="font-mono font-extrabold text-xl leading-none">${fmtX1T(s.pricePerCall)}<span class="text-xs text-slate-500 font-sans font-normal ml-1">X1T/call</span></div>
            <button data-call-id="${s.id}" class="callBtn bg-accent text-ink text-xs font-semibold rounded-lg px-3 py-1.5 hover:bg-lime-300 transition disabled:opacity-40 disabled:cursor-not-allowed" ${s.active ? '' : 'disabled'}>Call</button>
          </div>
        </div>
      </div>`;
    })
    .join('');

  grid.querySelectorAll('.callBtn').forEach((btn) => {
    btn.addEventListener('click', () => openCallModal(Number(btn.dataset.callId)));
  });
  grid.querySelectorAll('.copyAddrBtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(btn.dataset.copyAddress)
        .then(() => toast('Address copied', 'success'))
        .catch(() => toast('Could not copy address', 'error'));
    });
  });
}

async function renderMyServices() {
  const container = document.getElementById('myServices');
  const emptyEl = document.getElementById('myServicesEmpty');
  const connectEl = document.getElementById('myServicesConnect');

  if (!account) {
    container.innerHTML = '';
    emptyEl.classList.add('hidden');
    connectEl.classList.remove('hidden');
    return;
  }
  connectEl.classList.add('hidden');

  const mine = servicesCache.filter((s) => s.provider.toLowerCase() === account.toLowerCase());
  emptyEl.classList.toggle('hidden', mine.length > 0);

  container.innerHTML = mine
    .map((s) => `
      <div class="bg-panel border border-border rounded-2xl p-4" data-service-card="${s.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-bold">${escapeHtml(s.name)} <span class="text-xs font-normal text-slate-500">#${s.id}</span></div>
            <p class="text-xs text-slate-400 mt-1">${escapeHtml(s.description)}</p>
          </div>
          <span class="text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full ${s.active ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 bg-slate-500/10'}">${s.active ? 'ACTIVE' : 'INACTIVE'}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-3 text-center">
          <div class="bg-panel2 rounded-lg py-2">
            <div class="text-sm font-bold font-mono">${fmtX1T(s.pricePerCall)}</div>
            <div class="text-[10px] text-slate-500">X1T/call</div>
          </div>
          <div class="bg-panel2 rounded-lg py-2">
            <div class="text-sm font-bold font-mono">${s.totalCalls.toString()}</div>
            <div class="text-[10px] text-slate-500">total calls</div>
          </div>
          <div class="bg-panel2 rounded-lg py-2">
            <div class="text-sm font-bold font-mono">${fmtX1T(s.totalRevenue)}</div>
            <div class="text-[10px] text-slate-500">revenue (X1T)</div>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button data-edit-id="${s.id}" class="editBtn flex-1 bg-panel2 border border-border hover:border-accent/60 transition text-xs font-semibold rounded-lg py-2">Edit</button>
          <button data-toggle-id="${s.id}" class="toggleBtn flex-1 bg-panel2 border border-border hover:border-accent/60 transition text-xs font-semibold rounded-lg py-2">${s.active ? 'Deactivate' : 'Reactivate'}</button>
        </div>
        <div class="editForm hidden mt-3 pt-3 border-t border-border space-y-2" id="editForm-${s.id}"></div>
      </div>`)
    .join('');

  container.querySelectorAll('.editBtn').forEach((btn) => {
    btn.addEventListener('click', () => toggleEditForm(Number(btn.dataset.editId)));
  });
  container.querySelectorAll('.toggleBtn').forEach((btn) => {
    btn.addEventListener('click', () => quickToggleActive(Number(btn.dataset.toggleId), btn));
  });
}

async function refreshMyServices() {
  await loadServices();
}

function toggleEditForm(id) {
  const s = servicesCache.find((x) => x.id === id);
  const form = document.getElementById(`editForm-${id}`);
  if (!form.classList.contains('hidden')) {
    form.classList.add('hidden');
    return;
  }
  form.classList.remove('hidden');
  form.innerHTML = `
    <input class="edit-name w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm" value="${escapeHtml(s.name)}" maxlength="64" />
    <textarea class="edit-desc w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm resize-none" rows="2" maxlength="280">${escapeHtml(s.description)}</textarea>
    <div class="grid grid-cols-2 gap-2">
      <input class="edit-price bg-panel2 border border-border rounded-lg px-3 py-2 text-sm" type="number" min="0" step="0.0001" value="${ethers.formatEther(s.pricePerCall)}" />
      <input class="edit-cap bg-panel2 border border-border rounded-lg px-3 py-2 text-sm" type="number" min="0" step="1" value="${s.maxCallsPerDay}" />
    </div>
    <button class="saveEditBtn w-full bg-accent text-ink font-semibold text-sm rounded-lg py-2 hover:bg-lime-300 transition">Save changes</button>
  `;
  form.querySelector('.saveEditBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const name = form.querySelector('.edit-name').value.trim();
    const description = form.querySelector('.edit-desc').value.trim();
    const price = form.querySelector('.edit-price').value;
    const cap = form.querySelector('.edit-cap').value || '0';
    try {
      await runTx(
        () => signerContract.updateService(id, name, description, ethers.parseEther(price || '0'), BigInt(cap), s.active),
        { pending: 'Saving…', success: 'Service updated', button: btn }
      );
      form.classList.add('hidden');
      await loadServices();
    } catch {}
  });
}

async function quickToggleActive(id, btn) {
  const s = servicesCache.find((x) => x.id === id);
  try {
    await runTx(
      () => signerContract.updateService(id, s.name, s.description, s.pricePerCall, s.maxCallsPerDay, !s.active),
      { pending: 'Updating…', success: s.active ? 'Service deactivated' : 'Service reactivated', button: btn }
    );
    await loadServices();
  } catch {}
}

// ---------- register service ----------

const svcNameEl = document.getElementById('svcName');
const svcDescEl = document.getElementById('svcDesc');
svcNameEl.addEventListener('input', () => {
  document.getElementById('nameCount').textContent = `${svcNameEl.value.length}/64`;
});
svcDescEl.addEventListener('input', () => {
  document.getElementById('descCount').textContent = `${svcDescEl.value.length}/280`;
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireWallet()) return;
  const name = svcNameEl.value.trim();
  const description = svcDescEl.value.trim();
  const price = document.getElementById('svcPrice').value;
  const cap = document.getElementById('svcMaxCalls').value || '0';
  const btn = document.getElementById('registerBtn');

  try {
    await runTx(
      () => signerContract.registerService(name, description, ethers.parseEther(price), BigInt(cap)),
      { pending: 'Registering…', success: `"${name}" is live`, button: btn }
    );
    e.target.reset();
    document.getElementById('nameCount').textContent = '0/64';
    document.getElementById('descCount').textContent = '0/280';
    await loadServices();
  } catch {}
});

// ---------- account panel ----------

async function refreshAccountPanel() {
  const connectEl = document.getElementById('accountConnect');
  const bodyEl = document.getElementById('accountBody');
  if (!account) {
    connectEl.classList.remove('hidden');
    bodyEl.classList.add('hidden');
    return;
  }
  connectEl.classList.add('hidden');
  bodyEl.classList.remove('hidden');

  const [credit, earnings, name] = await Promise.all([
    readContract.consumerBalance(account),
    readContract.pendingWithdrawals(account),
    displayNameOr(account),
  ]);
  document.getElementById('creditBalance').textContent = fmtX1T(credit);
  document.getElementById('earningsBalance').textContent = fmtX1T(earnings);
  document.getElementById('withdrawEarningsBtn').disabled = earnings === 0n;
  if (name) document.getElementById('displayNameInput').value = name;
}

document.getElementById('nameForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!requireWallet()) return;
  const name = document.getElementById('displayNameInput').value.trim();
  const btn = document.getElementById('nameBtn');
  try {
    await runTx(() => signerContract.setDisplayName(name), { pending: 'Saving…', success: 'Display name saved', button: btn });
    renderWalletArea();
  } catch {}
});

document.getElementById('depositBtn').addEventListener('click', async () => {
  if (!requireWallet()) return;
  const amount = document.getElementById('depositAmount').value;
  if (!amount || Number(amount) <= 0) return toast('Enter an amount to deposit', 'error');
  const btn = document.getElementById('depositBtn');
  try {
    await runTx(() => signerContract.depositCredit({ value: ethers.parseEther(amount) }), { pending: 'Depositing…', success: 'Credit deposited', button: btn });
    document.getElementById('depositAmount').value = '';
    await refreshAccountPanel();
  } catch {}
});

document.getElementById('withdrawCreditBtn').addEventListener('click', async () => {
  if (!requireWallet()) return;
  const amount = document.getElementById('withdrawCreditAmount').value;
  if (!amount || Number(amount) <= 0) return toast('Enter an amount to withdraw', 'error');
  const btn = document.getElementById('withdrawCreditBtn');
  try {
    await runTx(() => signerContract.withdrawCredit(ethers.parseEther(amount)), { pending: 'Withdrawing…', success: 'Credit withdrawn', button: btn });
    document.getElementById('withdrawCreditAmount').value = '';
    await refreshAccountPanel();
  } catch {}
});

document.getElementById('withdrawEarningsBtn').addEventListener('click', async () => {
  if (!requireWallet()) return;
  const btn = document.getElementById('withdrawEarningsBtn');
  try {
    await runTx(() => signerContract.withdraw(), { pending: 'Withdrawing…', success: 'Earnings withdrawn', button: btn });
    await refreshAccountPanel();
  } catch {}
});

function requireWallet() {
  if (!account) {
    toast('Connect your wallet first', 'error');
    return false;
  }
  return true;
}

// ---------- call modal ----------

let activeCallServiceId = null;

async function openCallModal(id) {
  const s = servicesCache.find((x) => x.id === id);
  if (!s) return;
  activeCallServiceId = id;
  document.getElementById('modalServiceName').textContent = s.name;
  document.getElementById('modalServiceDesc').textContent = s.description;
  document.getElementById('modalPrice').textContent = fmtX1T(s.pricePerCall);
  document.getElementById('modalStatus').textContent = '';

  const creditBtn = document.getElementById('modalCallCredit');
  if (account) {
    const bal = await readContract.consumerBalance(account);
    document.getElementById('modalCreditBalance').textContent = fmtX1T(bal);
    creditBtn.disabled = bal < s.pricePerCall;
    creditBtn.classList.toggle('opacity-40', bal < s.pricePerCall);
  } else {
    document.getElementById('modalCreditBalance').textContent = '0.0';
    creditBtn.disabled = true;
    creditBtn.classList.add('opacity-40');
  }

  document.getElementById('callModal').classList.remove('hidden');
}

document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('callModal').classList.add('hidden');
});
document.getElementById('callModal').addEventListener('click', (e) => {
  if (e.target.id === 'callModal') document.getElementById('callModal').classList.add('hidden');
});

document.getElementById('modalCallCredit').addEventListener('click', async () => {
  if (!requireWallet()) return;
  const status = document.getElementById('modalStatus');
  status.textContent = 'Confirm in your wallet…';
  try {
    await runTx(() => signerContract.callService(activeCallServiceId), { pending: 'Calling…', success: 'Call settled — receipt recorded on-chain' });
    document.getElementById('callModal').classList.add('hidden');
    await loadServices();
    await refreshAccountPanel();
  } catch {
    status.textContent = '';
  }
});

document.getElementById('modalCallDirect').addEventListener('click', async () => {
  if (!requireWallet()) return;
  const s = servicesCache.find((x) => x.id === activeCallServiceId);
  const status = document.getElementById('modalStatus');
  status.textContent = 'Confirm in your wallet…';
  try {
    await runTx(() => signerContract.payAndCall(activeCallServiceId, { value: s.pricePerCall }), { pending: 'Paying…', success: 'Call settled — receipt recorded on-chain' });
    document.getElementById('callModal').classList.add('hidden');
    await loadServices();
  } catch {
    status.textContent = '';
  }
});

// ---------- activity feed ----------

let activityLoaded = false;
let settledEventsCache = null; // shared with the hero "fees collected" stat, so we don't fetch the same log twice

async function fetchSettledEvents() {
  if (!settledEventsCache) {
    settledEventsCache = await readContract.queryFilter(readContract.filters.CallSettled(), DEPLOY_BLOCK, 'latest');
  }
  return settledEventsCache;
}

// Lifetime platform fees collected — summed from the real fee paid on every
// CallSettled event, not derived/estimated, so it stays correct even if a
// service's price changed after some of its calls were already made.
async function loadLifetimeFees() {
  try {
    const events = await fetchSettledEvents();
    const totalFees = events.reduce((sum, ev) => sum + ev.args.fee, 0n);
    document.getElementById('statFees').textContent = fmtX1T(totalFees);
  } catch (err) {
    console.error(err);
    document.getElementById('statFees').textContent = '–';
  }
}

async function loadActivity() {
  if (activityLoaded) return;
  activityLoaded = true;
  const loadingEl = document.getElementById('activityLoading');
  const emptyEl = document.getElementById('activityEmpty');
  const body = document.getElementById('activityBody');
  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  try {
    const events = await fetchSettledEvents();
    const sorted = events.sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 100);
    loadingEl.classList.add('hidden');
    emptyEl.classList.toggle('hidden', sorted.length > 0);

    body.innerHTML = sorted
      .map((ev) => {
        const { receiptId, serviceId, consumer, payout, fee, timestamp } = ev.args;
        const svc = servicesCache.find((s) => s.id === Number(serviceId));
        return `
        <tr class="hover:bg-panel2/50 transition">
          <td class="px-4 py-3 font-mono text-xs text-slate-500">#${receiptId.toString()}</td>
          <td class="px-4 py-3">${escapeHtml(svc ? svc.name : `service #${serviceId}`)}</td>
          <td class="px-4 py-3 font-mono text-xs">${short(consumer)}</td>
          <td class="px-4 py-3 text-right font-mono text-xs text-emerald-400">+${fmtX1T(payout)}</td>
          <td class="px-4 py-3 text-right font-mono text-xs text-slate-500">${fmtX1T(fee)}</td>
          <td class="px-4 py-3 text-right text-xs text-slate-500">${timeAgo(timestamp)}</td>
        </tr>`;
      })
      .join('');
  } catch (err) {
    console.error(err);
    loadingEl.classList.add('hidden');
    toast('Could not load activity history', 'error');
  }
}

document.getElementById('refreshActivity').addEventListener('click', () => {
  activityLoaded = false;
  settledEventsCache = null;
  loadActivity();
});

readContract.on('CallSettled', () => {
  activityLoaded = false;
  settledEventsCache = null;
  loadServices();
  loadLifetimeFees();
  if (!document.getElementById('tab-activity').classList.contains('hidden')) loadActivity();
});

// ---------- boot ----------

(async function init() {
  renderWalletArea();
  await loadServices();
  loadLifetimeFees(); // don't block first paint on the historical event scan
  document.getElementById('showInactive').addEventListener('change', renderServiceGrid);

  if (window.ethereum) {
    try {
      const accs = await window.ethereum.request({ method: 'eth_accounts' });
      if (accs && accs.length) await connectWallet();
    } catch {}
  }
})();
