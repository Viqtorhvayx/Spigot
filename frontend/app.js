// Spigot frontend — vanilla JS + ethers v6, no build step.

const readProvider = new ethers.JsonRpcProvider(X1_RPC_URL);
const readContract = new ethers.Contract(CONTRACT_ADDRESS, METERLY_ABI, readProvider);

let browserProvider = null;
let signer = null;
let signerContract = null;
let account = null;

let servicesCache = []; // [{id, provider, name, description, pricePerCall, maxCallsPerDay, registeredAt, totalCalls, totalRevenue, active}]
let platformFeeBps = 250n; // 2.5% default, overwritten with the real on-chain value at boot

// ---------- icons (small inline set reused across dynamically-rendered markup) ----------

const ICON = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"/>',
  chevr: '<path d="M9.5 6 15 12l-5.5 6"/>',
  chev: '<path d="M6 9.5 12 15l6-5.5"/>',
  sort: '<path d="M8 9.5 12 5.5l4 4"/><path d="M8 14.5 12 18.5l4-4"/>',
  ext: '<path d="M14 4h6v6"/><path d="M19.5 4.5 11 13"/><path d="M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  arrow: '<path d="M5 12h13"/><path d="M12.5 6.5 19 12l-6.5 5.5"/>',
};
function svg(name, size = 14, sw = 2) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${ICON[name]}</svg>`;
}

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
  return `<span class="inline-block rounded-full shrink-0" style="width:${size}px;height:${size}px;background:${avatarColor(addr)}"></span>`;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(ts) {
  const secs = Math.floor(Date.now() / 1000) - Number(ts);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  return `${Math.floor(secs / 86400)}d`;
}

function fmtDate(ts) {
  return new Date(Number(ts) * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------- toasts ----------

function toast(message, type = 'info') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  const palette = {
    info: 'bg-panel/90 text-slate-200 border border-border',
    success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
    error: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
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
let walletConnectModule = null; // cached dynamic import, so reopening WalletConnect doesn't re-fetch the bundle
let connecting = false; // guards against a second click firing a duplicate, overlapping connection attempt

function connectButtonHtml() {
  return `
    <div class="relative">
      <button id="connectBtn" class="bg-accent text-ink font-semibold text-[13px] rounded-xl px-4 py-2 hover:bg-lime-300 transition whitespace-nowrap">Connect Wallet</button>
      <div id="connectMenu" class="hidden absolute right-0 mt-2 w-60 bg-panel border border-border rounded-xl shadow-lg overflow-hidden z-50">
        <button id="connectInjected" class="w-full text-left px-4 py-3 hover:bg-panel2 transition disabled:opacity-40 disabled:cursor-wait">
          <div class="text-sm font-semibold flex items-center gap-2"><span class="connectLabel">Browser Wallet</span></div>
          <div class="text-xs text-slate-500 connectSub">MetaMask or another extension</div>
        </button>
        <button id="connectWC" class="w-full text-left px-4 py-3 hover:bg-panel2 transition border-t border-border disabled:opacity-40 disabled:cursor-wait">
          <div class="text-sm font-semibold flex items-center gap-2"><span class="connectLabel">WalletConnect</span></div>
          <div class="text-xs text-slate-500 connectSub">Scan a QR with a mobile wallet</div>
        </button>
      </div>
    </div>`;
}

function walletPillHtml(idSuffix) {
  return `
    <div class="relative">
      <button id="walletPill${idSuffix}" class="flex items-center gap-2 bg-panel2 border border-border rounded-full pl-1.5 pr-3 py-1 hover:border-border2 transition">
        ${avatarHtml(account, 22)}
        <span class="text-sm font-mono walletAddrLabel">${short(account)}</span>
      </button>
      <div id="walletMenu${idSuffix}" class="hidden absolute right-0 mt-2 w-44 bg-panel border border-border rounded-xl shadow-lg overflow-hidden z-50">
        <button class="disconnectBtn w-full text-left px-4 py-3 text-sm font-semibold text-rose-400 hover:bg-panel2 transition">Disconnect</button>
      </div>
    </div>`;
}

// Renders into both the desktop topbar and the mobile topbar slots, so the
// connect/disconnect flow works identically regardless of viewport.
function renderWalletArea() {
  const targets = [
    { host: document.getElementById('walletAreaDesktop'), suffix: 'Desktop' },
    { host: document.getElementById('walletAreaMobile'), suffix: 'Mobile' },
  ];

  if (!account) {
    for (const { host } of targets) host.innerHTML = connectButtonHtml();
    for (const { host } of targets) {
      const menu = host.querySelector('#connectMenu');
      host.querySelector('#connectBtn').onclick = (e) => {
        e.stopPropagation();
        menu.classList.toggle('hidden');
      };
      const injectedBtn = host.querySelector('#connectInjected');
      const wcBtn = host.querySelector('#connectWC');
      injectedBtn.onclick = (e) => { e.stopPropagation(); runConnect(injectedBtn, wcBtn, 'Connecting…', connectWallet); };
      wcBtn.onclick = (e) => { e.stopPropagation(); runConnect(wcBtn, injectedBtn, 'Opening wallet…', connectWalletConnect); };
      document.addEventListener('click', () => menu.classList.add('hidden'), { once: true });
    }
    return;
  }

  for (const { host, suffix } of targets) {
    host.innerHTML = walletPillHtml(suffix);
    const menu = host.querySelector(`#walletMenu${suffix}`);
    host.querySelector(`#walletPill${suffix}`).onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    };
    host.querySelector('.disconnectBtn').onclick = disconnectWallet;
    document.addEventListener('click', () => menu.classList.add('hidden'), { once: true });
  }
  displayNameOr(account).then((name) => {
    if (name) document.querySelectorAll('.walletAddrLabel').forEach((el) => (el.textContent = name));
  });
}

// Gives the connect-menu buttons immediate visual feedback the moment they're
// clicked, instead of nothing happening until the wallet prompt (or an
// error) eventually shows up — which is exactly what made a slow wallet
// handshake look broken and invited a second, overlapping click.
async function runConnect(activeBtn, otherBtn, pendingLabel, fn) {
  if (connecting) return;
  activeBtn.disabled = true;
  otherBtn.disabled = true;
  const labelEl = activeBtn.querySelector('.connectLabel');
  const subEl = activeBtn.querySelector('.connectSub');
  const originalLabel = labelEl.textContent;
  const originalSub = subEl.textContent;
  labelEl.innerHTML = `<span class="spinner"></span> ${pendingLabel}`;
  subEl.textContent = 'Check your wallet…';
  try {
    await fn();
  } finally {
    if (document.body.contains(activeBtn)) {
      activeBtn.disabled = false;
      otherBtn.disabled = false;
      labelEl.textContent = originalLabel;
      subEl.textContent = originalSub;
    }
  }
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
  if (document.getElementById('view-detail') && !document.getElementById('view-detail').classList.contains('hidden')) renderDetailFull();
  if (wasConnected && !silent) toast('Wallet disconnected', 'info');
}

async function disconnectWallet() {
  const activeWcProvider = wcProvider;
  const wasInjected = !wcProvider && !!window.ethereum && !!account;
  resetWalletState({ silent: true });
  if (activeWcProvider) {
    try {
      await activeWcProvider.disconnect();
    } catch (err) {
      console.error('error tearing down WalletConnect session:', err);
    }
  } else if (wasInjected) {
    // Clearing our own JS state isn't enough — MetaMask (and most injected
    // wallets) remember this site as authorized until the site explicitly
    // revokes it, otherwise the eth_accounts check at boot silently
    // reconnects the exact same account on the very next page load, which
    // looks like "Disconnect" never worked at all. wallet_revokePermissions
    // (EIP-2255) is the real revoke; not every wallet supports it yet, so
    // this is best-effort and we don't surface the failure — the site-side
    // session is still fully cleared either way.
    try {
      await window.ethereum.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      });
    } catch (err) {
      console.warn('wallet does not support wallet_revokePermissions — it may still show Spigot as connected:', err);
    }
  }
  toast('Wallet disconnected', 'info');
}

// Injected wallet (MetaMask extension, or a mobile wallet's in-app browser).
// Every step below talks to window.ethereum directly and is fully awaited
// before the next one fires — some mobile wallet bridges throw a "could not
// coalesce" error when they receive overlapping requests, which happens if
// ethers' own automatic network detection races with our explicit calls.
// Passing a static `network` to BrowserProvider below disables that
// auto-detection entirely.
// `silent` is used only for the boot-time restore below: it must never
// produce a wallet prompt, a network-switch request, or a toast — those are
// exactly what makes a page *load* look like a wallet just connected itself.
// eth_accounts (unlike eth_requestAccounts) never prompts; it only returns
// accounts this site is already authorized for, so a silent restore is safe.
async function connectWallet({ silent = false } = {}) {
  if (connecting) return;
  if (!window.ethereum) {
    if (!silent) toast('No browser wallet found — try WalletConnect instead, or install MetaMask', 'error');
    return;
  }
  connecting = true;
  try {
    const accounts = silent
      ? await window.ethereum.request({ method: 'eth_accounts' })
      : await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (!accounts || !accounts.length) return; // nothing authorized — stay disconnected, no prompt either way

    if (silent) {
      // Never force a network switch on an unattended restore — if the
      // wallet isn't already on X1, just leave the session disconnected
      // until the user explicitly clicks Connect.
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId?.toLowerCase() !== X1_CHAIN_ID_HEX) return;
    } else {
      await ensureNetworkInjected();
    }

    browserProvider = new ethers.BrowserProvider(window.ethereum, { chainId: X1_CHAIN_ID_DEC, name: 'x1-maculatus' });
    signer = await browserProvider.getSigner();
    await finishConnect({ silent });
  } catch (err) {
    if (!silent) {
      console.error(err);
      toast(friendlyError(err), 'error');
    }
  } finally {
    connecting = false;
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
  if (connecting) return;
  if (!WALLETCONNECT_PROJECT_ID) {
    toast('WalletConnect isn\'t configured on this deployment yet — use a browser wallet for now', 'error');
    return;
  }
  connecting = true;
  try {
    if (!walletConnectModule) {
      walletConnectModule = await import('https://esm.sh/@walletconnect/ethereum-provider@2.17.0?bundle');
    }
    const { EthereumProvider } = walletConnectModule;
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
    wcProvider.on('disconnect', () => resetWalletState());
    await wcProvider.enable();
    browserProvider = new ethers.BrowserProvider(wcProvider, { chainId: X1_CHAIN_ID_DEC, name: 'x1-maculatus' });
    signer = await browserProvider.getSigner();
    await finishConnect();
  } catch (err) {
    console.error(err);
    toast(friendlyError(err), 'error');
  } finally {
    connecting = false;
  }
}

async function finishConnect({ silent = false } = {}) {
  signerContract = new ethers.Contract(CONTRACT_ADDRESS, METERLY_ABI, signer);
  account = await signer.getAddress();
  renderWalletArea();
  refreshAccountPanel();
  refreshMyServices();
  if (!document.getElementById('view-detail').classList.contains('hidden')) await renderDetailFull();
  if (!silent) toast('Wallet connected', 'success');
}

if (window.ethereum) {
  window.ethereum.on?.('accountsChanged', () => window.location.reload());
  window.ethereum.on?.('chainChanged', () => window.location.reload());
}

// ---------- view switching (sidebar rail + bottom nav share one mechanism) ----------

const VIEW_META = {
  browse: { title: 'Browse Services', sub: 'Live services you can call and pay for per request.' },
  provider: { title: 'Provider Dashboard', sub: 'List a service, set a price, withdraw what it earns.' },
  account: { title: 'My Account', sub: 'Your prepaid credit, earnings, and public identity.' },
  activity: { title: 'Activity', sub: 'Every settled call, straight from the contract log.' },
};

function switchView(view) {
  document.querySelectorAll('.view-panel').forEach((p) => p.classList.add('hidden'));
  const panel = document.getElementById(`view-${view}`);
  panel.classList.remove('hidden');
  panel.classList.add('fade-in');

  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const meta = VIEW_META[view];
  if (meta) {
    document.getElementById('viewTitle').textContent = meta.title;
    document.getElementById('viewSubtitle').textContent = meta.sub;
  }

  if (view === 'activity') loadActivity();
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Lets the marketing homepage deep-link straight into a view, e.g.
// app.html?view=provider from its "Register a service" button.
{
  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (requestedView && VIEW_META[requestedView]) switchView(requestedView);
}

document.getElementById('creditChipDesktop').addEventListener('click', () => switchView('account'));

// ---------- services: load, filter, sort, render ----------

let filterState = 'active'; // 'all' | 'active' | 'inactive'
let sortState = 'calls'; // 'calls' | 'new' | 'price'
let serviceSearchTerm = '';

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

function getFilteredSortedServices() {
  let list = servicesCache.filter((s) => {
    if (filterState === 'active') return s.active;
    if (filterState === 'inactive') return !s.active;
    return true;
  });
  if (serviceSearchTerm) {
    const q = serviceSearchTerm.toLowerCase();
    list = list.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
  }
  list = [...list];
  if (sortState === 'calls') list.sort((a, b) => (b.totalCalls > a.totalCalls ? 1 : b.totalCalls < a.totalCalls ? -1 : 0));
  else if (sortState === 'new') list.sort((a, b) => Number(b.registeredAt) - Number(a.registeredAt));
  else if (sortState === 'price') list.sort((a, b) => (a.pricePerCall > b.pricePerCall ? 1 : a.pricePerCall < b.pricePerCall ? -1 : 0));
  return list;
}

async function renderServiceGrid() {
  const grid = document.getElementById('serviceGrid');
  const list = getFilteredSortedServices();
  document.getElementById('serviceCount').textContent = list.length;
  document.getElementById('serviceEmpty').classList.toggle('hidden', list.length > 0);
  if (!list.length) {
    grid.innerHTML = '';
    return;
  }

  const labels = await Promise.all(list.map((s) => displayNameOr(s.provider)));

  grid.innerHTML = list
    .map((s, idx) => {
      const providerLabel = labels[idx] || short(s.provider);
      const cap = s.maxCallsPerDay > 0n ? `${s.maxCallsPerDay}/day per caller` : 'no daily cap';
      return `
      <div class="service-card bg-panel border border-border rounded-xl p-5 flex flex-col transition hover:border-border2 cursor-pointer ${s.active ? '' : 'opacity-50'}" data-open-id="${s.id}">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-mono text-[15px] text-slate-500 truncate">${escapeHtml(providerLabel)}</span>
          <span class="text-[15px] text-border2 shrink-0">/</span>
          <span class="text-[15px] font-bold text-slate-100 truncate">${escapeHtml(s.name)}</span>
          <span class="text-slate-500 shrink-0">${svg('chevr', 14, 2)}</span>
        </div>
        <p class="text-[13px] text-slate-400 leading-relaxed mt-2.5 line-clamp-2">${escapeHtml(s.description)}</p>
        <div class="flex flex-wrap gap-1.5 mt-3.5">
          <span class="inline-flex items-center gap-1.5 text-[11px] ${s.active ? 'text-emerald-400' : 'text-slate-500'} bg-panel2 rounded px-2 py-1"><span class="w-1.5 h-1.5 rounded-full ${s.active ? 'bg-emerald-400' : 'bg-slate-500'}"></span>${s.active ? 'Active' : 'Inactive'}</span>
          <span class="inline-flex items-center gap-1.5 text-[11px] text-accent bg-panel2 rounded px-2 py-1">${s.totalCalls.toString()} calls settled</span>
          <span class="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-panel2 rounded px-2 py-1">${svg('clock', 11, 2)}${cap}</span>
        </div>
        <div class="flex-1"></div>
        <div class="flex items-end justify-between border-t border-border mt-4 pt-4">
          <div>
            <div class="flex items-baseline gap-1.5"><span class="tabular-nums text-2xl font-black tracking-tight text-accent leading-none">${fmtX1T(s.pricePerCall)}</span><span class="text-[12px] text-slate-500">X1T</span></div>
            <div class="text-[10.5px] text-slate-500 mt-1.5">per call</div>
          </div>
          <button data-call-id="${s.id}" class="callBtn accent-pill border text-[13px] font-semibold rounded-xl px-4 py-2.5 transition disabled:opacity-40 disabled:cursor-not-allowed" ${s.active ? '' : 'disabled'}>Call</button>
        </div>
      </div>`;
    })
    .join('');

  grid.querySelectorAll('.service-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.callBtn')) return;
      openDetail(Number(card.dataset.openId));
    });
  });
  grid.querySelectorAll('.callBtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetail(Number(btn.dataset.callId));
    });
  });
}

document.querySelectorAll('#statusSeg [data-filter]').forEach((btn) => {
  btn.addEventListener('click', () => {
    filterState = btn.dataset.filter;
    document.querySelectorAll('#statusSeg [data-filter]').forEach((b) => b.classList.toggle('active', b === btn));
    renderServiceGrid();
  });
});
document.querySelectorAll('#sortChips [data-sort]').forEach((btn) => {
  btn.addEventListener('click', () => {
    sortState = btn.dataset.sort;
    document.querySelectorAll('#sortChips [data-sort]').forEach((b) => {
      b.classList.toggle('active', b === btn);
      b.classList.toggle('text-slate-500', b !== btn);
    });
    renderServiceGrid();
  });
});
document.getElementById('serviceSearch').addEventListener('input', (e) => {
  serviceSearchTerm = e.target.value.trim();
  renderServiceGrid();
});

// Accent "pill" buttons (Call, Deposit, Withdraw) show their solid pressed
// look via this explicit .is-pressed class rather than :active — on touch
// devices :active can get left stuck on after a tap instead of clearing on
// release, which is what made Deposit look permanently "clicked". Delegated
// on document so it also covers callBtn instances re-rendered after every
// renderServiceGrid() call.
function clearPressedPills() {
  document.querySelectorAll('.accent-pill.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
}
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.accent-pill');
  if (btn && !btn.disabled) btn.classList.add('is-pressed');
});
document.addEventListener('pointerup', clearPressedPills);
document.addEventListener('pointercancel', clearPressedPills);
document.addEventListener('pointerout', (e) => {
  const btn = e.target.closest('.accent-pill');
  if (btn && (!e.relatedTarget || !btn.contains(e.relatedTarget))) btn.classList.remove('is-pressed');
});
window.addEventListener('blur', clearPressedPills);

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
      <div class="bg-panel border border-border rounded-xl p-4" data-service-card="${s.id}">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-bold text-[14px]">${escapeHtml(s.name)} <span class="text-xs font-normal text-slate-500 font-mono">#${s.id}</span></div>
            <p class="text-[12.5px] text-slate-400 mt-1">${escapeHtml(s.description)}</p>
          </div>
          <span class="text-[10px] font-semibold shrink-0 px-2 py-0.5 rounded-full ${s.active ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 bg-slate-500/10'}">${s.active ? 'ACTIVE' : 'INACTIVE'}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-3 text-center">
          <div class="bg-panel2 rounded-lg py-2">
            <div class="text-[13px] font-bold tabular-nums">${fmtX1T(s.pricePerCall)}</div>
            <div class="text-[10px] text-slate-500">X1T/call</div>
          </div>
          <div class="bg-panel2 rounded-lg py-2">
            <div class="text-[13px] font-bold tabular-nums">${s.totalCalls.toString()}</div>
            <div class="text-[10px] text-slate-500">total calls</div>
          </div>
          <div class="bg-panel2 rounded-lg py-2">
            <div class="text-[13px] font-bold tabular-nums">${fmtX1T(s.totalRevenue)}</div>
            <div class="text-[10px] text-slate-500">revenue (X1T)</div>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button data-edit-id="${s.id}" class="editBtn flex-1 bg-panel2 border border-border2 hover:border-slate-500 transition text-[12px] font-semibold rounded-xl py-2">Edit</button>
          <button data-toggle-id="${s.id}" class="toggleBtn flex-1 bg-panel2 border border-border2 hover:border-slate-500 transition text-[12px] font-semibold rounded-xl py-2">${s.active ? 'Deactivate' : 'Reactivate'}</button>
        </div>
        <div class="editForm hidden mt-3 pt-3 border-t border-border flex flex-col gap-2" id="editForm-${s.id}"></div>
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

document.getElementById('refreshMyServices').addEventListener('click', () => loadServices());

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
    <button class="saveEditBtn w-full bg-accent text-ink font-semibold text-sm rounded-xl py-2 hover:bg-lime-300 transition">Save changes</button>
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

  if (!name) return toast('Enter a service name', 'error');
  if (!description) return toast('Enter a description', 'error');
  if (!price || Number(price) <= 0) return toast('Enter a price per call', 'error');

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
  const setCredit = (v) => {
    document.getElementById('creditBalance').textContent = v;
    document.getElementById('creditChipValueDesktop').textContent = v;
    document.getElementById('creditChipValueMobile').textContent = v;
  };
  if (!account) {
    setCredit('0.0');
    document.getElementById('earningsBalance').textContent = '0.0';
    document.getElementById('withdrawEarningsBtn').disabled = true;
    document.getElementById('myCallsSettled').textContent = '–';
    return;
  }

  const [credit, earnings, name] = await Promise.all([
    readContract.consumerBalance(account),
    readContract.pendingWithdrawals(account),
    displayNameOr(account),
  ]);
  setCredit(fmtX1T(credit));
  document.getElementById('earningsBalance').textContent = fmtX1T(earnings);
  document.getElementById('withdrawEarningsBtn').disabled = earnings === 0n;
  if (name) document.getElementById('displayNameInput').value = name;

  try {
    const myIds = new Set(servicesCache.filter((s) => s.provider.toLowerCase() === account.toLowerCase()).map((s) => s.id));
    const events = await fetchSettledEvents();
    const mine = events.filter((ev) => myIds.has(Number(ev.args.serviceId)));
    document.getElementById('myCallsSettled').textContent = mine.length;
  } catch {
    document.getElementById('myCallsSettled').textContent = '–';
  }
}

document.getElementById('platformFeeLabel').textContent = '2.5%'; // refined once platformFeeBps loads at boot

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

// ---------- service detail view ----------
// Replaces the old call modal. Built around the "before -> after" projection
// pattern: every number shown is either read straight from the chain, or a
// one-call-from-now projection computed from those real numbers — nothing
// fabricated.

let activeDetailId = null;
let detailPayMode = 'direct'; // 'direct' | 'credit'
let detailTab = 'overview'; // 'overview' | 'receipts'
let detailCache = null; // { s, receipts, used, creditBal }

async function openDetail(id) {
  activeDetailId = id;
  detailPayMode = 'direct';
  detailTab = 'overview';
  detailCache = null;
  document.querySelectorAll('.view-panel').forEach((p) => p.classList.add('hidden'));
  const panel = document.getElementById('view-detail');
  panel.classList.remove('hidden');
  panel.classList.add('fade-in');
  document.getElementById('detailBody').innerHTML = '<div class="text-slate-500 text-sm py-16 text-center">Loading…</div>';
  window.scrollTo({ top: 0 });
  await loadDetailData(id);
  renderDetailFull();
}

document.getElementById('detailBack').addEventListener('click', () => switchView('browse'));

async function loadDetailData(id) {
  const s = servicesCache.find((x) => x.id === id);
  if (!s) return;
  let receipts = [];
  try {
    const events = await fetchSettledEvents();
    receipts = events.filter((ev) => Number(ev.args.serviceId) === id).sort((a, b) => b.blockNumber - a.blockNumber).slice(0, 50);
  } catch (err) {
    console.error(err);
  }
  let used = null;
  let creditBal = null;
  if (account) {
    try {
      const epoch = BigInt(Math.floor(Date.now() / 1000 / 86400));
      const reads = await Promise.all([
        s.maxCallsPerDay > 0n ? readContract.callsInEpoch(id, epoch, account) : Promise.resolve(null),
        readContract.consumerBalance(account),
      ]);
      used = reads[0];
      creditBal = reads[1];
    } catch (err) {
      console.error(err);
    }
  }
  detailCache = { s, receipts, used, creditBal };
}

function feeSplit(price) {
  const fee = (price * platformFeeBps) / 10000n;
  return { fee, providerReceives: price - fee };
}

function detailReceiptRowHtml(ev) {
  const { receiptId, consumer, payout, fee, timestamp } = ev.args;
  return `
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="font-mono text-[11px] text-slate-400 bg-panel2 rounded px-1.5 py-0.5 shrink-0">#${receiptId.toString()}</span>
        <span class="font-mono text-[11.5px] text-slate-500 truncate">${short(consumer)}</span>
      </div>
      <div class="text-right shrink-0">
        <div class="tabular-nums font-semibold text-[12.5px] text-accent">+${fmtX1T(payout)}</div>
        <div class="tabular-nums font-medium text-[10px] text-slate-500 mt-0.5">fee ${fmtX1T(fee)} · ${timeAgo(timestamp)} ago</div>
      </div>
    </div>`;
}

function renderDetailFull() {
  if (!detailCache) return;
  const { s } = detailCache;
  const cap = s.maxCallsPerDay > 0n ? `${s.maxCallsPerDay} / day per caller` : 'No daily cap';

  const attrsLeft = [
    ['serviceId', s.id],
    ['provider', short(s.provider)],
    ['pricePerCall', `${fmtX1T(s.pricePerCall)} X1T`],
    ['maxCallsPerDay', s.maxCallsPerDay.toString()],
  ];
  const attrsRight = [
    ['totalCalls', s.totalCalls.toString()],
    ['totalRevenue', `${fmtX1T(s.totalRevenue)} X1T`],
    ['active', s.active ? 'true' : 'false'],
    ['registeredAt', fmtDate(s.registeredAt)],
  ];
  const kvHtml = (rows) => rows.map(([k, v], i) =>
    `<div class="flex items-center justify-between gap-3 py-2.5 ${i ? 'border-t border-border' : ''}">
       <span class="text-[12.5px] text-slate-500">${k}</span>
       <span class="tabular-nums font-semibold text-[12.5px] text-slate-100 text-right">${escapeHtml(String(v))}</span>
     </div>`).join('');

  document.getElementById('detailBody').innerHTML = `
    <div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="font-mono text-xl sm:text-2xl text-slate-500 whitespace-nowrap">${short(s.provider)} /</span>
        <span class="text-xl sm:text-2xl font-bold text-slate-100">${escapeHtml(s.name)}</span>
      </div>
      <div class="flex flex-wrap gap-1.5 mt-3.5">
        <span class="inline-flex items-center gap-1.5 text-[11px] ${s.active ? 'text-emerald-400' : 'text-slate-500'} bg-panel2 rounded px-2 py-1"><span class="w-1.5 h-1.5 rounded-full ${s.active ? 'bg-emerald-400' : 'bg-slate-500'}"></span>${s.active ? 'Active' : 'Inactive'}</span>
        <span class="inline-flex items-center text-[11px] font-mono text-slate-400 bg-panel2 rounded px-2 py-1">serviceId ${s.id}</span>
        <span class="inline-flex items-center text-[11px] text-slate-400 bg-panel2 rounded px-2 py-1">X1 EcoChain · Maculatus</span>
        <a href="https://maculatus-scan.x1eco.com/address/${CONTRACT_ADDRESS}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-panel2 rounded px-2 py-1 hover:text-slate-200 transition">${svg('ext', 11, 2)}View on explorer</span></a>
      </div>
      <p class="text-[13.5px] text-slate-400 leading-relaxed mt-4 max-w-xl">${escapeHtml(s.description)}</p>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-5 sm:gap-7 py-5 border-t border-b border-border mt-5">
        <div><div class="text-[9.5px] font-semibold tracking-widest uppercase text-slate-500 mb-2">Price / call</div><div class="tabular-nums text-xl sm:text-2xl font-bold tracking-tight">${fmtX1T(s.pricePerCall)}<span class="text-[11px] text-slate-500 font-sans ml-1">X1T</span></div></div>
        <div><div class="text-[9.5px] font-semibold tracking-widest uppercase text-slate-500 mb-2">Total calls</div><div class="tabular-nums text-xl sm:text-2xl font-bold tracking-tight">${s.totalCalls.toString()}</div></div>
        <div><div class="text-[9.5px] font-semibold tracking-widest uppercase text-slate-500 mb-2">Total revenue</div><div class="tabular-nums text-xl sm:text-2xl font-bold tracking-tight">${fmtX1T(s.totalRevenue)}<span class="text-[11px] text-slate-500 font-sans ml-1">X1T</span></div></div>
        <div><div class="text-[9.5px] font-semibold tracking-widest uppercase text-slate-500 mb-2">Daily cap</div><div class="tabular-nums text-xl sm:text-2xl font-bold tracking-tight">${s.maxCallsPerDay > 0n ? s.maxCallsPerDay.toString() : '∞'}<span class="text-[11px] text-slate-500 font-sans ml-1">${s.maxCallsPerDay > 0n ? '/ caller' : ''}</span></div></div>
      </div>

      <div class="flex gap-5 mt-5 border-b border-border">
        <button data-dtab="overview" class="dtab text-[13px] font-semibold pb-3 -mb-px border-b-2 ${detailTab === 'overview' ? 'text-slate-100 border-slate-100' : 'text-slate-500 border-transparent'}">Overview</button>
        <button data-dtab="receipts" class="dtab text-[13px] font-semibold pb-3 -mb-px border-b-2 ${detailTab === 'receipts' ? 'text-slate-100 border-slate-100' : 'text-slate-500 border-transparent'}">Receipts <span class="tabular-nums font-semibold text-[11px]">(${detailCache.receipts.length})</span></button>
      </div>

      <div id="dtab-overview" class="${detailTab === 'overview' ? '' : 'hidden'} grid sm:grid-cols-2 gap-x-7 mt-2">
        <div>${kvHtml(attrsLeft)}</div>
        <div>${kvHtml(attrsRight)}</div>
      </div>
      <div id="dtab-receipts" class="${detailTab === 'receipts' ? '' : 'hidden'} mt-2 border border-border rounded-xl overflow-hidden">
        ${detailCache.receipts.length
          ? detailCache.receipts.map(detailReceiptRowHtml).join('')
          : '<div class="text-center text-slate-500 text-sm py-10">No calls settled against this service yet.</div>'}
      </div>
    </div>

    <div id="detailCallPanel"></div>
  `;

  document.querySelectorAll('.dtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      detailTab = btn.dataset.dtab;
      renderDetailFull();
    });
  });

  renderCallPanel();
}

function renderCallPanel() {
  const el = document.getElementById('detailCallPanel');
  if (!el || !detailCache) return;
  const { s, used, creditBal } = detailCache;
  const { fee, providerReceives } = feeSplit(s.pricePerCall);

  let capRow;
  if (s.maxCallsPerDay === 0n) {
    capRow = `<div class="text-[12px] text-slate-500 py-2">No daily cap on this service.</div>`;
  } else if (used === null) {
    capRow = `<div class="text-[12px] text-slate-500 py-2">Connect your wallet to see your calls left today (cap: ${s.maxCallsPerDay}/day).</div>`;
  } else {
    const left = s.maxCallsPerDay - used;
    const after = left > 0n ? left - 1n : 0n;
    capRow = `
      <div class="flex items-center justify-between py-2.5">
        <span class="text-[12.5px] text-slate-500">Calls left today</span>
        <span class="flex items-center gap-1.5 tabular-nums font-semibold text-[12.5px]"><span class="text-slate-500">${left}</span><span class="text-border2">&rarr;</span><span class="${left > 0n ? 'text-accent' : 'text-rose-400'}">${after}</span></span>
      </div>`;
  }

  const creditKnown = creditBal !== null;
  const creditShort = creditKnown && creditBal < s.pricePerCall;
  const canCredit = creditKnown && !creditShort;

  el.innerHTML = `
    <div class="bg-panel border border-border rounded-xl p-5 lg:sticky lg:top-24">
      <div class="font-bold text-[14.5px]">Call this service</div>
      <div class="flex gap-0.5 bg-panel2 border border-border rounded-lg p-0.5 mt-3.5 mb-4">
        <button data-mode="direct" class="seg-btn ${detailPayMode === 'direct' ? 'active' : ''} flex-1 px-3 py-1.5 rounded-md text-[12px] transition">Pay per call</button>
        <button data-mode="credit" class="seg-btn ${detailPayMode === 'credit' ? 'active' : ''} flex-1 px-3 py-1.5 rounded-md text-[12px] transition">Prepaid credit</button>
      </div>
      <div class="bg-panel2 border border-border rounded-lg p-3.5">
        <div class="text-[9.5px] font-semibold tracking-widest uppercase text-slate-500">You pay</div>
        <div class="tabular-nums text-3xl font-black tracking-tight text-accent leading-none mt-2.5">${fmtX1T(s.pricePerCall)}<span class="text-[13px] text-slate-500 font-sans ml-1.5">X1T</span></div>
      </div>
      <div class="mt-1">
        <div class="flex items-center justify-between py-2.5 border-t border-border"><span class="text-[12.5px] text-slate-500">Platform fee (${(Number(platformFeeBps) / 100).toFixed(2)}%)</span><span class="tabular-nums font-semibold text-[12.5px]">${fmtX1T(fee)} X1T</span></div>
        <div class="flex items-center justify-between py-2.5 border-t border-border"><span class="text-[12.5px] text-slate-500">Provider receives</span><span class="tabular-nums font-semibold text-[12.5px]">${fmtX1T(providerReceives)} X1T</span></div>
      </div>
      <div class="border-t border-border">
        ${capRow}
        <div class="flex items-center justify-between py-2.5 border-t border-border"><span class="text-[12.5px] text-slate-500">Service total calls</span><span class="flex items-center gap-1.5 tabular-nums font-semibold text-[12.5px]"><span class="text-slate-500">${s.totalCalls}</span><span class="text-border2">&rarr;</span><span>${s.totalCalls + 1n}</span></span></div>
      </div>
      ${detailPayMode === 'credit' && creditKnown
        ? `<div class="text-[11.5px] ${creditShort ? 'text-rose-400' : 'text-slate-500'} mt-1 mb-2">Your balance: ${fmtX1T(creditBal)} X1T${creditShort ? ' — not enough for this call' : ''}</div>`
        : ''}
      <button id="detailCallBtn" class="w-full bg-accent text-ink font-semibold text-[13.5px] rounded-xl py-3 mt-3 hover:bg-lime-300 transition disabled:opacity-40 disabled:cursor-not-allowed" ${(!s.active) || (detailPayMode === 'credit' && creditKnown && !canCredit) ? 'disabled' : ''}>
        ${detailPayMode === 'direct' ? `Pay ${fmtX1T(s.pricePerCall)} X1T and call` : 'Call using credit'}
      </button>
      <div class="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 mt-3">Settles in one transaction</div>
    </div>
  `;

  el.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      detailPayMode = btn.dataset.mode;
      renderCallPanel();
    });
  });
  el.querySelector('#detailCallBtn').addEventListener('click', onDetailCallClick);
}

async function onDetailCallClick() {
  if (!requireWallet()) return;
  const { s } = detailCache;
  const btn = document.getElementById('detailCallBtn');
  try {
    if (detailPayMode === 'credit') {
      await runTx(() => signerContract.callService(s.id), { pending: 'Calling…', success: 'Call settled — receipt recorded on-chain', button: btn });
    } else {
      await runTx(() => signerContract.payAndCall(s.id, { value: s.pricePerCall }), { pending: 'Paying…', success: 'Call settled — receipt recorded on-chain', button: btn });
    }
    settledEventsCache = null;
    await loadServices();
    await refreshAccountPanel();
    if (activeDetailId === s.id) {
      await loadDetailData(s.id);
      renderDetailFull();
    }
  } catch {}
}

// ---------- activity feed ----------

let activityLoaded = false;
let settledEventsCache = null; // shared with the hero "fees collected" stat, so we don't fetch the same log twice
let activitySearchTerm = '';

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

function serviceNameFor(serviceId) {
  const svc = servicesCache.find((s) => s.id === Number(serviceId));
  return svc ? svc.name : `service #${serviceId}`;
}

function groupByService(events) {
  const order = [];
  const groups = new Map();
  for (const ev of events) {
    const id = Number(ev.args.serviceId);
    if (!groups.has(id)) {
      groups.set(id, []);
      order.push(id);
    }
    groups.get(id).push(ev);
  }
  return order.map((id) => ({ id, name: serviceNameFor(id), events: groups.get(id) }));
}

function getFilteredActivity() {
  const all = [...(settledEventsCache || [])].sort((a, b) => b.blockNumber - a.blockNumber);
  if (!activitySearchTerm) return all;
  const q = activitySearchTerm.toLowerCase();
  return all.filter((ev) => serviceNameFor(ev.args.serviceId).toLowerCase().includes(q) || ev.args.consumer.toLowerCase().includes(q));
}

function renderActivityTable() {
  const container = document.getElementById('activityTable');
  const list = getFilteredActivity().slice(0, 200);
  document.getElementById('activityCount').textContent = list.length;
  document.getElementById('activityEmpty').classList.toggle('hidden', list.length > 0);
  if (!list.length) {
    container.innerHTML = '';
    return;
  }

  const groups = groupByService(list);
  const headHtml = `
    <div class="hidden sm:grid grid-cols-[70px_1fr_140px_70px] gap-4 items-center px-4 py-3 bg-rail text-[9.5px] font-semibold tracking-widest uppercase text-slate-500">
      <div>Receipt</div><div>Consumer</div><div class="text-right">Payout</div><div class="text-right">When</div>
    </div>`;

  const bodyHtml = groups.map((g) => {
    const groupHead = `
      <div class="flex items-center gap-2 px-4 py-2.5 bg-rail border-t border-border">
        <span class="text-slate-500">${svg('chev', 13, 2.2)}</span>
        <span class="text-[12.5px] font-semibold">${escapeHtml(g.name)}</span>
        <span class="tabular-nums font-semibold text-[11px] text-slate-500 bg-panel2 rounded px-1.5 py-0.5">${g.events.length}</span>
      </div>`;
    const rows = g.events.map((ev) => {
      const { receiptId, consumer, payout, fee, timestamp } = ev.args;
      const receiptPill = `<span class="font-mono text-[12px] text-slate-400 bg-panel2 rounded px-2 py-1">#${receiptId.toString()}</span>`;
      return `
        <div class="border-t border-border hover:bg-white/[0.02] transition">
          <div class="sm:hidden flex items-center justify-between gap-3 px-4 py-3">
            <div class="flex flex-col items-start gap-1.5 min-w-0">
              ${receiptPill}
              <span class="font-mono text-[11.5px] text-slate-500 truncate">${short(consumer)}</span>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
              <span class="tabular-nums font-semibold text-[13px] text-accent">+${fmtX1T(payout)}</span>
              <span class="tabular-nums font-medium text-[10.5px] text-slate-500">fee ${fmtX1T(fee)} &middot; ${timeAgo(timestamp)}</span>
            </div>
          </div>
          <div class="hidden sm:grid grid-cols-[70px_1fr_140px_70px] gap-4 items-center px-4 py-3">
            <div>${receiptPill}</div>
            <div class="font-mono text-[12px] text-slate-500 truncate">${short(consumer)}</div>
            <div class="text-right">
              <span class="tabular-nums font-semibold text-[13px] text-accent">+${fmtX1T(payout)}</span>
              <span class="tabular-nums font-medium text-[10.5px] text-slate-500 ml-2">fee ${fmtX1T(fee)}</span>
            </div>
            <div class="text-right text-[12px] text-slate-500">${timeAgo(timestamp)}</div>
          </div>
        </div>`;
    }).join('');
    return groupHead + rows;
  }).join('');

  container.innerHTML = headHtml + bodyHtml;
}

async function loadActivity() {
  const loadingEl = document.getElementById('activityLoading');
  const emptyEl = document.getElementById('activityEmpty');
  if (activityLoaded) {
    renderActivityTable();
    return;
  }
  activityLoaded = true;
  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  try {
    await fetchSettledEvents();
    loadingEl.classList.add('hidden');
    renderActivityTable();
  } catch (err) {
    console.error(err);
    loadingEl.classList.add('hidden');
    toast('Could not load activity history', 'error');
  }
}

document.getElementById('activitySearch').addEventListener('input', (e) => {
  activitySearchTerm = e.target.value.trim();
  renderActivityTable();
});

document.getElementById('refreshActivity').addEventListener('click', () => {
  activityLoaded = false;
  settledEventsCache = null;
  loadActivity();
});

document.getElementById('exportActivity').addEventListener('click', () => {
  const list = getFilteredActivity();
  if (!list.length) return toast('Nothing to export', 'error');
  const header = 'receiptId,service,consumer,payoutX1T,feeX1T,timestampISO\n';
  const rows = list.map((ev) => {
    const { receiptId, serviceId, consumer, payout, fee, timestamp } = ev.args;
    const name = serviceNameFor(serviceId).replace(/,/g, ' ');
    const iso = new Date(Number(timestamp) * 1000).toISOString();
    return `${receiptId},${name},${consumer},${ethers.formatEther(payout)},${ethers.formatEther(fee)},${iso}`;
  }).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spigot-receipts.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(`Exported ${list.length} receipts`, 'success');
});

readContract.on('CallSettled', (...args) => {
  const event = args[args.length - 1];
  const affectedServiceId = event?.args ? Number(event.args.serviceId) : null;
  activityLoaded = false;
  settledEventsCache = null;
  loadServices();
  loadLifetimeFees();
  if (!document.getElementById('view-activity').classList.contains('hidden')) loadActivity();
  if (!document.getElementById('view-detail').classList.contains('hidden') && activeDetailId === affectedServiceId) {
    loadDetailData(activeDetailId).then(renderDetailFull);
  }
});

// ---------- boot ----------

(async function init() {
  renderWalletArea();
  try {
    platformFeeBps = await readContract.PLATFORM_FEE_BPS();
  } catch (err) {
    console.error('could not read PLATFORM_FEE_BPS, using 2.5% default:', err);
  }
  document.getElementById('platformFeeLabel').textContent = `${(Number(platformFeeBps) / 100).toFixed(2)}%`;
  await loadServices();
  loadLifetimeFees(); // don't block first paint on the historical event scan

  if (window.ethereum) {
    await connectWallet({ silent: true });
  }
})();
