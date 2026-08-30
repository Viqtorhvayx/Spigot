# Spigot

Pay-per-call settlement rails for APIs, AI agents, and machine services on
[X1 EcoChain](https://x1ecochain.com) (Maculatus testnet).

Spigot is an X1-native implementation of the same pattern as
[x402](https://x402.org) (HTTP 402 Payment Required): a caller pays per
request, a provider gets paid instantly, and every call leaves an on-chain
receipt. X1 EcoChain's own vision names "machine-to-machine payments" and
"AI agent transactions" as core use cases — Spigot is a working settlement
layer for exactly that, live on Maculatus today.

**Contract:** [`0xf4b3191C7a3315F0d2B375162E3025E78B25B595`](https://maculatus-scan.x1eco.com/address/0xf4b3191C7a3315F0d2B375162E3025E78B25B595)
(deployment block `10248541`)

## Why this, and not another tipping/social app

An API, model endpoint, or data feed can't wait for a subscription invoice
or a human to click "pay" — it needs to charge per request, in real time,
to callers that are often other programs. There's no existing settlement
rail for that on X1 EcoChain. Spigot is that rail: a provider lists a
service and a price; any consumer — human or agent — pays per call and gets
served. No off-chain billing, no invoicing, no trust required between
strangers. Turn the tap on, per request, and it's paid for.

## How it works

- **Register a service** — name, description, price per call, and an
  optional daily call cap per consumer (rate-limiting built in, not bolted
  on).
- **Two payment modes**, because occasional callers and high-frequency
  agents have different needs:
  - `payAndCall(serviceId)` — pay the exact price directly with the
    transaction, one-shot, no setup.
  - `callService(serviceId)` — draw down from a prepaid credit balance
    (`depositCredit`). Built for agents making many calls, where prompting
    a wallet on every single request isn't viable.
- **Every call settles instantly on-chain.** A 2.5% platform fee is split
  off; the rest is credited to the provider. Both accumulate as pull
  payments (`pendingWithdrawals`) — providers and the fee recipient
  withdraw on their own schedule, never pushed to them.
- **Every call emits a receipt** (`CallSettled`, with a sequential
  `receiptId`) — a public, auditable log of who paid whom, how much, and
  when. The frontend's Activity tab is just this event log rendered live.

## Contract design

- **Custom errors**, not require-strings, throughout — cheaper, and every
  failure mode is a named type (`InsufficientCredit`, `DailyLimitReached`,
  `ServiceInactive`, etc.) instead of a string to parse.
- **Pull-payment pattern** for all value transfers out of the contract —
  `pendingWithdrawals[account]` accumulates, `withdraw()` pulls it. No
  push-sends inside the settlement path, so a misbehaving recipient can
  never block other callers or other providers.
- **Manual reentrancy guard** (`nonReentrant`) on both withdrawal paths
  (`withdraw`, `withdrawCredit`), the only functions that send value out.
- **Bounded strings** — `MAX_NAME_LENGTH` (64) and `MAX_DESC_LENGTH` (280)
  — so no one can grief storage costs with unbounded service metadata.
- **Daily rate limiting is per-service, per-consumer, per-day**, tracked in
  `callsInEpoch[serviceId][epoch][consumer]` where `epoch =
  block.timestamp / 1 days`. It's enforced identically for both payment
  paths (`_checkAndMeter` is shared), so a consumer can't dodge their cap
  by switching from prepaid credit to direct payment mid-day — verified
  live, see below.
- **Sequential service and receipt IDs** (`totalServices`,
  `totalCallsSettled`) so a frontend can enumerate the full history without
  needing an indexer.

## What's genuinely unfinished (said plainly)

- **No x402 HTTP middleware yet.** The contract is the settlement primitive
  an x402-style `402 Payment Required` gateway would call into — that
  middleware (verify a payment header, call `payAndCall`/`callService`,
  return the resource) isn't built. It's the natural next layer, not
  required for the on-chain rails to work standalone.
- **No indexer/subgraph.** The Activity feed does a direct
  `queryFilter` against the RPC node from `DEPLOY_BLOCK`. Fine at current
  volume; would need a real indexer at scale.
- **Service discovery is a flat list.** No categories, search, or ranking
  beyond "active vs. inactive" — acceptable for a first version, not a
  finished marketplace.

## Repo layout

```
contracts/Spigot.sol    — the contract
test/Spigot.test.js     — 16 Hardhat tests
scripts/deploy.js       — deployment script
frontend/               — static site (no build step): index.html, app.js, config.js
```

## Running it locally

```bash
npm install
npm test               # 16 tests
npm run deploy:testnet # requires PRIVATE_KEY in .env, funded via the X1 Discord faucet
```

Then serve `frontend/` with any static file server — it talks directly to
the deployed contract via `https://maculatus-rpc.x1eco.com/` for reads, and
to an injected wallet (MetaMask or compatible) for writes. It'll prompt to
add/switch to the Maculatus testnet (chain ID `10778`) if needed.

## Live verification

Every function was exercised against the live Maculatus testnet with two
freshly generated, independently funded wallets (a provider and a
consumer) — not just local Hardhat tests:

1. Registered "Weather Oracle API" — 0.05 X1T/call, capped at 2 calls/day
   per consumer.
2. Consumer deposited 1.0 X1T of prepaid credit.
3. Called the service twice via `callService` — balance moved
   1.0 → 0.95 → 0.9 X1T exactly.
4. A 3rd `callService` call reverted with `DailyLimitReached`, as expected.
5. Tried `payAndCall` (direct payment) for a 3rd call instead — also
   reverted with `DailyLimitReached`, confirming the cap is shared across
   both payment paths rather than being bypassable by switching modes.
6. Read back the service's stats: `totalCalls = 2`,
   `totalRevenue = 0.0975 X1T` — exactly `2 × 0.05 × 0.975`, confirming the
   2.5% fee split is mathematically exact on-chain.
7. Provider's `pendingWithdrawals` read back as `0.0975 X1T`.
8. Provider called `withdraw()` — wallet balance changed by exactly
   `0.0975 X1T` (net of gas).

All 16 Hardhat tests pass independently, covering the same paths plus edge
cases (unauthorized updates, zero/oversized inputs, double-withdraw
rejection, per-consumer-independent rate limits, epoch reset via
`time.increase`).

The frontend was smoke-tested with a headless browser against this exact
deployed contract: the Browse tab renders the real registered service with
its real stats, and the Activity tab renders both real `CallSettled`
receipts from the flow above with the exact expected payout/fee split.

## Network

| | |
|---|---|
| Chain | X1 EcoChain — Maculatus Testnet |
| Chain ID | 10778 |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
| Native token | X1T (faucet: `/faucet <address>` in the X1 Discord `#faucet` channel, 100 X1T per claim, once per 24h) |

## License

MIT — see [LICENSE](./LICENSE).
