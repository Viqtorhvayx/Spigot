# Templates

X1 Forge ships two starter templates. Pick one with `--template <name>` (defaults to `default`).

```bash
npx create-x1-app my-dapp                     # Greeter template
npx create-x1-app my-token --template erc20   # ERC-20 template
```

## `default` — Greeter

A minimal contract with a getter and a setter, the fastest path to a working deploy. Good starting point for any custom contract — swap `contracts/Greeter.sol` for your own logic.

- Contract: `Greeter.sol` — `greet()` / `setGreeting(string)`
- Frontend: connect wallet, add network, read/write the contract
- Verified live: [`0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755`](https://maculatus-scan.x1eco.com/address/0xaF8ecc6741c26BCCc7ccCe9BfC1f2Cd73E8a2755)

## `erc20` — Token

An [OpenZeppelin](https://www.openzeppelin.com/contracts) `ERC20` token (`X1Token`, symbol `X1S`) that mints an initial supply to the deployer. Good starting point for a project token, points program, or in-app currency.

- Contract: `X1Token.sol` — standard OpenZeppelin ERC-20, 1,000,000 initial supply
- Frontend: connect wallet, add network, check balance, transfer
- Verified live: [`0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53`](https://maculatus-scan.x1eco.com/address/0xB41DB8E536DDb13670239577dd06d6e4bFEE9C53)

## Both templates share

- Hardhat preconfigured for the Maculatus testnet (chain ID `10778`)
- `npm run compile`, `npm run test`, `npm run deploy:testnet`
- A `frontend/` demo using plain HTML + ethers.js (no framework/build step required)
- `.env.example` for your `PRIVATE_KEY`

## Adding your own template

Templates are plain directories under `packages/create-x1-app/templates/`. To add one:

1. Copy an existing template directory (e.g. `templates/default`) to `templates/<name>`.
2. Edit its contracts, scripts, and frontend as needed.
3. It's immediately available as `create-x1-app <project> --template <name>` — no registration step required, the CLI reads the `templates/` directory directly.

See [`packages/create-x1-app/bin/create-x1-app.js`](../packages/create-x1-app/bin/create-x1-app.js) for the scaffolding logic.
