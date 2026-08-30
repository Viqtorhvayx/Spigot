# Quickstart

## 1. Scaffold a project

```bash
npx create-x1-app my-dapp
cd my-dapp
npm install
```

## 2. Configure your wallet

Copy the env template and add a private key for a testnet-only wallet (never use a wallet holding real funds):

```bash
cp .env.example .env
```

## 3. Get testnet X1T

The X1 EcoChain faucet is Discord-based. Join the official Discord server, go to `#faucet`, and run:

```
/faucet <your-wallet-address>
```

You'll receive 100 X1T. Claims are limited to once per 24 hours, and your wallet balance must be under 500 X1T to remain eligible.

## 4. Compile and test

```bash
npm run compile
npm run test
```

## 5. Deploy to the Maculatus testnet

```bash
npm run deploy:testnet
```

This prints the deployed contract address and a link to view it on the [block explorer](https://maculatus-scan.x1eco.com/).

## 6. Try the frontend demo

Open `frontend/index.html` in a browser. Connect your wallet, add the X1 EcoChain network with one click, then paste in your deployed contract address to read and write the sample `Greeter` contract.

## Network reference

| | |
|---|---|
| Chain ID | `10778` |
| RPC | `https://maculatus-rpc.x1eco.com/` |
| Explorer | `https://maculatus-scan.x1eco.com/` |
| Native token | `X1T` |

## Next steps

- Swap `contracts/Greeter.sol` for your own contract.
- Explore the [JS SDK](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/js-sdk) and [Python SDK](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/python-sdk) for higher-level integrations.
- Verify your contract using the [Verify Smart Contract guide](https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/deploying-on-x1-ecochain/verify-smart-contract).
