# X1 Forge

The official developer starter kit for [X1 EcoChain](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper) — a low-energy, EVM-compatible Layer-1 running on physically distributed low-power nodes.

X1 Forge lowers the barrier for the next builder on X1 EcoChain: one command scaffolds a ready-to-deploy dApp, preconfigured for the Maculatus testnet, with wallet connect, a sample contract, and deploy/verify scripts already wired up.

## Quickstart

```bash
npx create-x1-app my-dapp
cd my-dapp
npm install
cp .env.example .env   # add your PRIVATE_KEY
npm run deploy:testnet
```

Check RPC health any time with:

```bash
npx create-x1-app status
```

Scaffold the ERC-20 starter instead of the default `Greeter` demo:

```bash
npx create-x1-app my-token --template erc20
```

See [`packages/create-x1-app`](./packages/create-x1-app) for the CLI, and `packages/create-x1-app/templates/` for what gets scaffolded (`default` and `erc20`).

## Reference dApp

[`examples/faucet-dapp`](./examples/faucet-dapp) — a self-serve claim faucet built entirely with X1 Forge: an ERC-20 with an on-chain cooldown-gated `claim()` function, plus a frontend to use it. Live on the Maculatus testnet: [`0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`](https://maculatus-scan.x1eco.com/address/0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F) — `claim()` has been exercised live (a successful claim, and a correctly-reverted second attempt during cooldown), not just tested locally.

## Docs

Full docs live in [`docs/`](./docs) — [quickstart](./docs/quickstart.md), [templates](./docs/templates.md), [JS SDK guide](./docs/js-sdk-guide.md), [Python SDK guide](./docs/python-sdk-guide.md), [contract verification](./docs/verify-contract.md), and a [terminal walkthrough](./docs/walkthrough.md) recorded from real commands against the live testnet.

`docs/` is a plain Jekyll site (`_config.yml` included) at the repo root, so GitHub Pages can serve it natively — no custom build pipeline needed. **One manual step is still needed**: in the repo's Settings → Pages, set "Build and deployment → Source" to **Deploy from a branch**, then Branch: `main`, folder: `/docs`. There's no API for that toggle — it has to be a repo owner clicking it once. After that, the docs go live at `https://viqtorhvayx.github.io/X1Forge/`.

## Project structure

```
X1Forge/
├── packages/
│   └── create-x1-app/       CLI that scaffolds new projects, plus `status` command
│       └── templates/
│           ├── default/     Hardhat + wallet-connect starter dApp
│           └── erc20/       OpenZeppelin ERC-20 starter with balance/transfer UI
├── docs/                    Docs site (quickstart, SDK guides, templates, walkthrough)
├── examples/
│   └── faucet-dapp/         Reference dApp: self-serve claim faucet, deployed live
└── GRANT_APPLICATION.md     X1 EcoChain Ecosystem Grants application draft
```

## Roadmap

- [x] **M1** — `create-x1-app` CLI + starter template (wallet connect, sample contract, deploy/verify scripts). Verified live: [`0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755`](https://maculatus-scan.x1eco.com/address/0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755)
- [x] **M2** — UX layer: one-click "Add to MetaMask", faucet instructions in CLI output, `status` command, second (ERC-20) template. Verified live: [`0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53`](https://maculatus-scan.x1eco.com/address/0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53)
- [x] **M3** — Docs/tutorial site: quickstart, templates guide, JS + Python SDK guides (both verified against live chain data), contract verification guide, and a real terminal walkthrough. Jekyll-ready at the repo root — needs one manual Pages toggle to go live (see above).
- [x] **M4** — Reference dApp built end-to-end with the kit, deployed live: [`examples/faucet-dapp`](./examples/faucet-dapp), a self-serve claim faucet at [`0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F`](https://maculatus-scan.x1eco.com/address/0xd76A5eB14a81Cb06A05474B97D028cD772EeBa2F), with `claim()` exercised live and its cooldown revert confirmed on-chain.

## Network reference

| | |
|---|---|
| Testnet | Maculatus |
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
| Native token | `X1T` |
| Faucet | Discord `#faucet` channel — `/faucet <address>` |

## License

MIT
