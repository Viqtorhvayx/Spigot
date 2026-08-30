# X1 Faucet — a X1 Forge reference dApp

A self-serve claim faucet for a test ERC-20 token (`X1F`) — click a button in your browser to claim tokens, instead of needing to go through the Discord bot. Built entirely with X1 Forge's stack (Hardhat + OpenZeppelin + ethers.js) as the kit's worked example, per Milestone 4.

**Live on the Maculatus testnet:** [`0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`](https://maculatus-scan.x1eco.com/address/0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F)

The `claim()` function has been exercised live against this deployment (not just in local tests): a claim succeeded, minted 50 `X1F`, and a second immediate claim correctly reverted with `"Claim cooldown active"` — confirming the on-chain cooldown works as designed.

## What it demonstrates

- A non-trivial contract pattern beyond a getter/setter or a plain transfer: per-address cooldown state, an owner-adjustable claim amount and cooldown period (`Ownable`), and a view function (`timeUntilNextClaim`) the frontend polls to drive UI state.
- A polished single-page frontend (no framework, no build step) that connects a wallet, adds the network in one click, shows a live balance, and disables the claim button until the cooldown clears.
- The full X1 Forge pipeline used end-to-end: scaffold pattern → compile → test → deploy → verify manually against the live chain.

## Contract

`contracts/X1FaucetToken.sol` — an OpenZeppelin `ERC20` + `Ownable`:

- `claim()` — mints `claimAmount` (default 50 `X1F`) to the caller if their cooldown has elapsed; reverts otherwise.
- `timeUntilNextClaim(address)` — view helper the frontend uses to show a countdown and gate the claim button.
- `setClaimAmount(uint256)` / `setCooldown(uint256)` — owner-only knobs.

## Setup

```bash
npm install
cp .env.example .env   # add your PRIVATE_KEY
```

Get testnet X1T for gas via the Discord faucet (`/faucet <address>` in `#faucet`, 100 X1T per claim, once per 24h).

## Compile, test, deploy

```bash
npm run compile
npm run test
npm run deploy:testnet
```

4 tests cover: initial minting, claim + cooldown enforcement (including a `time.increase` to confirm claiming again after the cooldown), the `timeUntilNextClaim` view, and owner-only access control.

## Frontend

Open `frontend/index.html` in a browser (or serve it statically). It's already pointed at the live deployed contract above — connect a wallet with testnet X1T for gas, and try a claim.

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
