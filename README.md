# Tipstream

Creator tipping on X1 EcoChain. A fan sends a tip, the contract splits it automatically — a 2.5% platform fee, the rest lands straight in the creator's wallet, instantly and verifiably on-chain.

**Live on the Maculatus testnet:** [`0x634fC0f2613AB092aAA6f6cFF4b42f49F5eD32aF`](https://maculatus-scan.x1eco.com/address/0x634fC0f2613AB092aAA6f6cFF4b42f49F5eD32aF)

The fee split has been verified live, not just in local tests: a real creator registered, a real 1 X1T tip was sent from a separate wallet, and the creator's balance increased by exactly `0.975 X1T` — matching the 2.5% fee precisely, confirmed both by wallet balance and on-chain contract state (`totalReceived`).

## Why this

Grant reviewers reward two things above all: real users and real revenue. Tipstream has both by construction — the user is anyone who wants to support a creator with money (a far bigger, more obvious audience than infrastructure operators or developers), and the revenue is a literal fee baked into every transaction, not a hypothetical future business model. It's honest about existing competition (LoopX already does payments/subscriptions on X1 EcoChain) — the bet here is on better execution of a proven mechanic, not on finding empty ecosystem space.

## Contract

`contracts/Tipstream.sol`:

- `registerCreator(string name, string bio)` — one-time page setup per address.
- `tip(address creator, string message) payable` — splits `msg.value`: 2.5% to the immutable `feeRecipient`, 97.5% straight to the creator, both sent in the same transaction.
- `creators(address)` — public getter for a creator's profile and stats (`totalReceived`, `tipCount`).
- `getCreators()` / `creatorCount()` — for building the discovery grid.

6 tests cover registration + duplicate rejection, tipping an unregistered address, a zero-value tip, the exact fee split (verified with `changeEtherBalances` across fan/creator/fee recipient), multi-tip accumulation, and multi-creator tracking.

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

The deploy script sets the deploying wallet as the fee recipient — swap in a dedicated treasury address for a real launch.

## Frontend

`frontend/index.html` — a real designed UI (Tailwind, not unstyled HTML): a hero, a "become a creator" panel that becomes a stats panel once registered, and a discovery grid of every creator with a one-click tip modal. Already pointed at the live contract above.

## Honest limitations (read before pitching this)

- **Push payments**: the contract sends funds directly via `.call{value}()` during `tip()`. This is simple and instantly demoable, but a production version should consider a pull-payment (withdraw) pattern so one bad actor's `receive()` reverting can't block a specific creator's tips.
- **No content-gating**: this is tipping only — no paywalled content, subscriptions, or perks. That's a deliberate v1 scope cut (secure content-gating needs real infrastructure), not an oversight.
- **LoopX already exists** in this space on X1 EcoChain. This project competes on execution, not on being first — be upfront about that in any pitch rather than implying it's unclaimed territory.

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
