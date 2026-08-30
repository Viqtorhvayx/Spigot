# X1 App

A starter dApp for **X1 EcoChain**, scaffolded with [create-x1-app](https://github.com/Viqtorhvayx/X1Forge). Includes a sample Solidity contract, Hardhat deploy/test scripts wired to the Maculatus testnet, and a minimal wallet-connect frontend.

## Network

| | |
|---|---|
| Name | X1 EcoChain — Maculatus Testnet |
| Chain ID | `10778` |
| RPC URL | `https://maculatus-rpc.x1eco.com/` |
| Native token | `X1T` |
| Explorer | `https://maculatus-scan.x1eco.com/` |

## Setup

```bash
npm install
cp .env.example .env   # add your PRIVATE_KEY
```

### Get testnet X1T

The faucet runs on Discord. Join the X1 EcoChain server and, in `#faucet`, run:

```
/faucet <your-wallet-address>
```

You get 100 X1T per claim, once every 24 hours, and your wallet balance must be under 500 X1T to remain eligible.

## Compile, test, deploy

```bash
npm run compile
npm run test
npm run deploy:testnet
```

The deploy script prints the deployed address and a direct link to view it on the explorer.

## Frontend demo

Open `frontend/index.html` in a browser (or serve it with any static server). It lets you:

- Connect a wallet
- Add the X1 EcoChain testnet to MetaMask in one click
- Read and write the sample `Greeter` contract once you paste in its deployed address

## Learn more

- [X1 EcoChain docs](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper)
- [JS SDK](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/js-sdk)
- [Python SDK](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/python-sdk)
