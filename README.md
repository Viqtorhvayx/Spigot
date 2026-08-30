# Verinode

On-chain liveness attestation for X1 EcoChain node operators. Instead of self-reported uptime claims, operators register and submit periodic on-chain heartbeats — anyone can verify who's actually running a live node, and for how long, directly from the chain.

**Live on the Maculatus testnet:** [`0xC76bC2E969803C059888218DB532DEa9B63a8D8E`](https://maculatus-scan.x1eco.com/address/0xC76bC2E969803C059888218DB532DEa9B63a8D8E)

**Live dashboard:** [x1-forge-mu.vercel.app](https://x1-forge-mu.vercel.app)

The full flow has been exercised live against this deployment, not just in local tests: a node registered (`registerNode`), submitted a heartbeat (`heartbeat`), was confirmed `isActive`, and a second immediate heartbeat correctly reverted with `"Heartbeat too soon"` — confirming the cooldown works on-chain.

## Why this, and why X1 EcoChain specifically

X1 EcoChain's entire pitch is physical decentralization through thousands of low-power nodes — but nothing in its current ecosystem lets anyone verify that claim on-chain. Existing node projects (Fastnode, Nodes.garden, xNode) are generic node-hosting/deployment tooling; none of them produce a verifiable, on-chain record of which nodes are actually live. Verinode is that missing piece: a minimal attestation layer any node operator (or any project that wants to prove infrastructure uptime) can adopt.

**Honest scope note:** this proves the protocol works end-to-end — contract, agent script, and dashboard all functioning against the live chain. It does not yet have real X1Node operators running it; that adoption is a go-to-market question, not something faked here. The self-test above uses one wallet acting as a demo operator.

## Contract

`contracts/Verinode.sol`:

- `registerNode(string label)` — one-time registration per address.
- `heartbeat()` — records liveness; reverts if called before `MIN_INTERVAL` (30 minutes) has elapsed since the last one.
- `isActive(address)` — true if the operator's last heartbeat is within `ACTIVE_WINDOW` (2 hours).
- `getOperators()` / `operatorCount()` — for building dashboards over the full registered set.

5 tests cover registration (including duplicate rejection), heartbeat cooldown enforcement, the active/inactive transition over time, and multi-operator tracking.

## The agent

`scripts/agent.js` is the piece a real node operator would run — a plain Node script (no Hardhat dependency) that registers once, then submits a heartbeat every 30 minutes for as long as it runs. This is the actual DePIN tooling: something you'd deploy alongside the node itself (cron job, systemd service, or a long-lived process).

```bash
npm install
cp .env.example .env   # PRIVATE_KEY, CONTRACT_ADDRESS, NODE_LABEL
npm run agent
```

## Compile, test, deploy

```bash
npm run compile
npm run test
npm run deploy:testnet
```

## Frontend

`frontend/index.html` — a dashboard showing every registered operator, their live/inactive status, heartbeat count, and last-seen time, plus a self-serve panel to register and heartbeat from a connected wallet. Already pointed at the live contract above, and deployed at [x1-forge-mu.vercel.app](https://x1-forge-mu.vercel.app).

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
