# Tipstream

Creator tipping on X1 EcoChain. A fan sends a tip, the contract splits it automatically — a 2.5% platform fee, the rest owed to the creator, withdrawable instantly and verifiably on-chain.

**Live on the Maculatus testnet:** [`0xB0C1F54c8E87Ef003794cB40Afac43A384d32eb7`](https://maculatus-scan.x1eco.com/address/0xB0C1F54c8E87Ef003794cB40Afac43A384d32eb7)

The full flow has been verified live, not just in local tests: a creator registered from one wallet, a fan sent a 2 X1T tip from a separate wallet, the contract credited the creator `1.95 X1T` (97.5%) as a pending withdrawal, and the creator then withdrew it — their wallet balance increased by exactly that amount, net of gas. Confirmed by wallet balance changes and on-chain contract state, not assumed.

## Why this

Grant reviewers reward two things above all: real users and real revenue. Tipstream has both by construction — the user is anyone who wants to support a creator with money (a far bigger, more obvious audience than infrastructure operators or developers), and the revenue is a literal fee baked into every transaction, not a hypothetical future business model. It's honest about existing competition (LoopX already does payments/subscriptions on X1 EcoChain) — the bet here is on better execution of a proven mechanic, not on finding empty ecosystem space.

## Contract

`contracts/Tipstream.sol`:

- `registerCreator(string name, string bio)` — one-time page setup per address.
- `tip(address creator, string message) payable` — splits `msg.value`: 2.5% credited to the immutable `feeRecipient`, 97.5% credited to the creator, both as **pending withdrawals**, not pushed immediately.
- `withdraw()` — pulls your full pending balance to your wallet. Anyone with a nonzero balance can call it — creators and the fee recipient use the same function.
- `creators(address)` — public getter for a creator's profile and stats (`totalReceived`, `tipCount`).
- `pendingWithdrawals(address)` — how much an address can currently withdraw.
- `getCreators()` / `creatorCount()` — for building the discovery grid.
- `TipSent` event carries `from`, `to`, `payout`, `fee`, `message`, and `timestamp` — the frontend's activity feeds are built entirely from this, no extra storage needed.

**Why pull payments, not push:** the first version sent funds directly during `tip()`. That's simple but fragile — if a creator's address can't receive funds (a bad `receive()`, a full/broken contract wallet), it blocks their tips entirely and can revert the fan's transaction too. Pull payments (`tip()` only credits a balance; `withdraw()` moves it) mean a broken recipient only affects themselves, never fans or other creators. This is the standard security pattern for handling other people's money on-chain.

7 tests cover registration + duplicate rejection, tipping an unregistered address, a zero-value tip, the exact fee split into pending balances, withdrawing (and being unable to double-withdraw), multi-tip accumulation, and multi-creator tracking.

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

`frontend/index.html` — a real designed UI (Tailwind, not unstyled HTML):

- **Discover page** — hero, a "become a creator" panel that becomes a stats + share-link panel once registered, a creator grid, and a global recent-activity feed built from `TipSent` events.
- **Shareable creator pages** — `?creator=0x...` renders a dedicated profile (name, bio, stats, a big Tip button, and that creator's own tip history). This is the actual link a creator would share, not just a card on a homepage.
- **Withdraw widget** — appears for any connected wallet with a nonzero pending balance (creator or platform treasury) and calls `withdraw()` directly.

Already pointed at the live contract above.

## Honest limitations (read before pitching this)

- **No content-gating**: this is tipping only — no paywalled content, subscriptions, or perks. That's a deliberate v1 scope cut (secure content-gating needs real infrastructure), not an oversight.
- **LoopX already exists** in this space on X1 EcoChain. This project competes on execution, not on being first — be upfront about that in any pitch rather than implying it's unclaimed territory.
- **Activity feed queries the full event range** from deployment to latest block on every load. Fine at current volume; would need pagination or an indexer (e.g. subgraph-style) if tip volume grew large.

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
