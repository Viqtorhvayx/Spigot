# JavaScript SDK Guide

X1 EcoChain is EVM-compatible, so any standard Ethereum JS library works. The [official docs](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/js-sdk) recommend three options — this guide uses **ethers.js**, the one X1 Forge's templates are built on.

| Library | Notes |
|---|---|
| **ethers.js** (recommended) | Promise-based, TypeScript support, used throughout X1 Forge |
| web3.js | Original Ethereum JS library, larger ecosystem |
| viem | TypeScript-first, type-safe contract calls |

> **Note:** the official JS SDK doc page's example points at `https://nubica-rpc.x1eco.com` — as of this writing that endpoint returns a 502 (dead). Use the live Maculatus testnet endpoint below instead.

## Install

```bash
npm install ethers
```

## Connect and read a balance

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://maculatus-rpc.x1eco.com/');

const address = '0xYourAddressHere';
const balance = await provider.getBalance(address);
console.log(`${ethers.formatEther(balance)} X1T`);
```

## Network reference

| | |
|---|---|
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
| Native token | `X1T` |

## Send a transaction

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://maculatus-rpc.x1eco.com/');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const tx = await wallet.sendTransaction({
  to: '0xRecipientAddress',
  value: ethers.parseEther('1.0'),
});
await tx.wait();
console.log(`Confirmed: ${tx.hash}`);
```

## Call a contract

Both X1 Forge templates use this exact pattern — see [`packages/create-x1-app/templates/default/frontend/app.js`](../packages/create-x1-app/templates/default/frontend/app.js) and the `erc20` template's `app.js` for full working examples (read calls, write calls, and browser wallet connection via `ethers.BrowserProvider`).

```javascript
const abi = ['function greet() view returns (string)'];
const contract = new ethers.Contract(contractAddress, abi, provider);
console.log(await contract.greet());
```

## Where this is used in X1 Forge

- `packages/create-x1-app/templates/default/scripts/deploy.js` — deploy via ethers + Hardhat
- `packages/create-x1-app/templates/*/frontend/app.js` — browser wallet connect, reads, and writes
- `packages/create-x1-app/bin/create-x1-app.js` — the `status` command uses raw JSON-RPC (no ethers dependency needed for the CLI itself)
