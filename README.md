# Tipstream

Creator tipping on X1 EcoChain. A fan sends a tip, the contract splits it automatically — a 2.5% platform fee, the rest owed to the creator, withdrawable instantly and verifiably on-chain.

**Live demo:** [tipstream-iota.vercel.app](https://tipstream-iota.vercel.app)
**Live contract on the Maculatus testnet:** [`0x2813aD535c5dffCd83Ae20caB8a3DD85776850b1`](https://maculatus-scan.x1eco.com/address/0x2813aD535c5dffCd83Ae20caB8a3DD85776850b1)

The full flow has been verified live, end to end, not assumed from tests: a creator registered, updated their name and bio (`updateProfile`), received a 1.5 X1T tip from a separate wallet, had `1.4625 X1T` (97.5%) correctly credited as a pending withdrawal, and withdrew it — wallet balance increased by exactly that amount, net of gas. A second withdrawal attempt correctly reverted. Every number above was read back from the chain, not computed locally and hoped to match.

## Why this

Grant reviewers reward two things above all: real users and real revenue. Tipstream has both by construction — the user is anyone who wants to support a creator with money (a far bigger, more obvious audience than infrastructure operators or developers), and the revenue is a literal fee baked into every transaction, not a hypothetical future business model. It's honest about existing competition (LoopX already does payments/subscriptions on X1 EcoChain) — the bet here is on better execution of a proven mechanic, not on finding empty ecosystem space.

## Contract

`contracts/Tipstream.sol`:

- `registerCreator(string name, string bio)` — one-time page creation.
- `updateProfile(string name, string bio)` — change your name/bio afterward. Stats and tip history are untouched.
- `tip(address creator, string message) payable` — splits `msg.value`: 2.5% credited to the immutable `feeRecipient`, 97.5% credited to the creator, both as **pending withdrawals**, not pushed immediately.
- `withdraw()` — pulls your full pending balance to your wallet, guarded against reentrancy. Anyone with a nonzero balance can call it — creators and the fee recipient use the same function.
- `creators(address)` — public getter for a creator's profile and stats (`totalReceived`, `tipCount`).
- `pendingWithdrawals(address)` — how much an address can currently withdraw.
- `getCreators()` / `creatorCount()` — for building the discovery grid.
- `TipSent` event carries `from`, `to`, `payout`, `fee`, `message`, and `timestamp` — the frontend's activity feeds are built entirely from this, no extra storage needed.

**Design choices worth knowing:**

- **Pull payments, not push.** `tip()` only credits a balance; `withdraw()` moves it. A broken recipient (bad `receive()`, a full contract wallet) can only ever block themselves, never a fan's transaction or another creator's tips. Standard practice for handling other people's money on-chain.
- **Custom errors, not require strings.** Every revert (`NameTooLong`, `CreatorNotRegistered`, `NothingToWithdraw`, etc.) is a named custom error — cheaper on gas than string reverts and just as readable in a trace.
- **Bounded input lengths.** Names cap at 64 bytes, bios and tip messages at 280 — prevents anyone bloating contract storage or griefing gas costs with huge strings.
- **Explicit reentrancy guard on `withdraw()`.** The checks-effects-interactions ordering already made this safe, but the guard is there as defense in depth, not decoration.

14 tests cover registration (including the length limits), profile updates, tipping (including message length and unregistered-recipient rejection), the exact fee split into pending balances, withdrawing (by both a creator and the fee recipient, and being unable to double-withdraw), and multi-creator tracking.

## Setup

```bash
npm install
cp .env.example .env   # add your PRIVATE_KEY
```

Get testnet X1T via the Discord faucet (`/faucet <address>` in `#faucet`, 100 X1T per claim, once per 24h).

## Compile, test, deploy

```bash
npm run compile
npm run test
npm run deploy:testnet
```

The deploy script sets the deploying wallet as the fee recipient and prints the deployment block number — the frontend needs that block to query tip history efficiently (see `frontend/app.js`'s `DEPLOY_BLOCK`). Swap in a dedicated treasury address for a real launch.

## Frontend

`frontend/index.html` — a real designed UI (Tailwind, not unstyled HTML), built to feel like a product rather than a demo:

- **Discover page** — hero, a "become a creator" panel that becomes a stats + share-link panel once registered, a creator grid, and a global recent-activity feed built from `TipSent` events.
- **Shareable creator pages** — `?creator=0x...` renders a dedicated profile (name, bio, stats, a big Tip button, and that creator's own tip history). This is the actual link a creator would share, not just a card on a homepage. Sets social meta tags and updates the tab title.
- **Withdraw widget** — appears for any connected wallet with a nonzero pending balance (creator or platform treasury) and calls `withdraw()` directly.
- **Edit profile** — creators can update their name/bio in place from their stats panel.
- **Toast notifications** for every action (connect, register, tip, withdraw, errors), instead of a raw debug dump — a collapsible "Transaction log" still exists underneath for anyone who wants to see the actual tx hashes.
- **Loading states** on every transaction button (spinner + label, disabled mid-flight) so it's never ambiguous whether a click registered.
- **Character counters** on every text input, matching the contract's actual on-chain limits (64/280/280).
- **Deterministic per-address avatar colors** — each creator gets a stable color from a small curated palette instead of one flat brand color everywhere.
- **Search and sort** on the discover grid (by name, top earning, most tips, or newest), and a **top-supporters leaderboard** on each creator page, computed from real `TipSent` history.

Already pointed at the live contract above. **Live demo:** [tipstream-iota.vercel.app](https://tipstream-iota.vercel.app)

**A real bug caught during this round, worth documenting rather than quietly fixing:** the code that loads all creators used `{ addr, ...(await contract.creators(addr)) }` to build each row. ethers v6's `Result` objects only expose numeric indices through spread/`Object.keys()` — named fields like `.name` and `.totalReceived` are getters that spread doesn't pick up. So every creator object silently had no `name`, `bio`, `totalReceived`, or `tipCount` on it, which would have thrown once the grid tried to render. It went unnoticed for several commits because verification always used direct property access (`c.name`) in test scripts rather than the frontend's actual spread pattern — a reminder that "verified against live data" is only as good as whether the test exercises the real code path, not just equivalent-looking logic. Fixed by explicitly pulling each field off the `Result` instead of spreading it.

## Honest limitations (read before pitching this)

- **No content-gating**: this is tipping only — no paywalled content, subscriptions, or perks. That's a deliberate v1 scope cut (secure content-gating needs real infrastructure), not an oversight.
- **LoopX already exists** in this space on X1 EcoChain. This project competes on execution, not on being first — be upfront about that in any pitch rather than implying it's unclaimed territory.
- **Activity feed queries the full event range** from deployment to latest block on every load. Fine at current volume; would need pagination or an indexer (e.g. subgraph-style) if tip volume grew large.
- **Social meta tags are static**, not per-creator. A shared `?creator=` link updates the browser tab title via JS, but crawlers that don't execute JS (most link-preview bots) will still see the generic Tipstream description, not that creator's name/bio. True per-creator previews need server-side rendering — out of scope for a static site.

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
