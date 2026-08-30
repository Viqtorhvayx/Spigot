# Walkthrough

A terminal recording of the full X1 Forge flow is at [`walkthrough.html`](./walkthrough.html) (played from [`walkthrough.cast`](./walkthrough.cast)). It's a real, unedited transcript of these commands run against the live Maculatus testnet while building X1 Forge — not a mockup.

> **Note on format:** this is a terminal-cast (asciinema), not a screen-recorded video — it's something this kit could produce directly and verify byte-for-byte, since every line in it is real output. A narrated screen recording covering the same steps is a good addition for the final submission; this script doubles as its shot list.

## The flow

```bash
$ npx create-x1-app my-dapp
```
Scaffolds a new project from the default template — sample contract, Hardhat config pointed at the Maculatus testnet, deploy/test scripts, and a wallet-connect frontend.

```bash
$ cd my-dapp && npm install
```
Installs Hardhat, the toolbox, and dotenv.

```bash
$ npm run compile
```
Compiles `Greeter.sol` against Solidity 0.8.24.

```bash
$ npm test
```
Runs the included test suite — deploys to an in-memory network and checks the greeting getter/setter.

```bash
$ npx create-x1-app status
```
Pings the live Maculatus RPC and reports chain ID, latest block, and latency — a quick sanity check before deploying anything real.

```bash
$ npm run deploy:testnet
```
Deploys to the real Maculatus testnet and prints the contract address plus a direct link to view it on the explorer.

## Try it yourself

Follow [the quickstart](./quickstart.md) to run this exact sequence against your own wallet.
