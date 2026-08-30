---
title: X1 Forge Docs
---

# X1 Forge

The official developer starter kit for [X1 EcoChain](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper).

```bash
npx create-x1-app my-dapp
```

## Guides

- [Quickstart](./quickstart.md) — scaffold, deploy, and interact with your first contract in under five minutes
- [Templates](./templates.md) — `default` (Greeter) vs `erc20` (token), and how to add your own
- [JS SDK Guide](./js-sdk-guide.md) — ethers.js against the Maculatus testnet
- [Python SDK Guide](./python-sdk-guide.md) — web3.py against the Maculatus testnet
- [Verifying Your Contract](./verify-contract.md) — publish source on the X1 EcoChain explorer
- [Walkthrough](./walkthrough.md) — a real terminal recording of the full flow

## Reference dApp

[X1 Faucet](https://github.com/Viqtorhvayx/X1Forge/tree/main/examples/faucet-dapp) — a worked example built end-to-end with X1 Forge: a self-serve claim faucet (ERC-20 with a cooldown-gated `claim()` function) and a frontend to use it, live on the Maculatus testnet at [`0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`](https://maculatus-scan.x1eco.com/address/0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F).

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
| Native token | `X1T` |
| Faucet | Discord `#faucet` — `/faucet <address>` |

## Source

[github.com/Viqtorhvayx/X1Forge](https://github.com/Viqtorhvayx/X1Forge)
