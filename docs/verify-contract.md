# Verifying Your Contract

Once deployed, verify your contract's source code on the X1 EcoChain explorer so anyone can read it and interact with it directly from the explorer UI.

## Steps

1. Deploy your contract (`npm run deploy:testnet`) and note the address it prints.
2. Go to the [X1 EcoChain Explorer](https://maculatus-scan.x1eco.com/).
3. Open the [Verify Contract](https://maculatus-scan.x1eco.com/contract-verification) tab.
4. Choose **Single File**, then upload a flattened version of your contract.
5. Fill in the requested metadata (contract name, compiler version — `0.8.24` for X1 Forge templates, optimization settings) and submit.

## Flattening your contract

Hardhat can produce the flattened single file the verifier expects:

```bash
npx hardhat flatten contracts/Greeter.sol > Greeter.flat.sol
```

(Swap `Greeter.sol` for `X1Token.sol` if you're on the `erc20` template.)

> The explorer's docs also mention direct Hardhat/Foundry artifact verification as an alternative to the single-file flow, but don't publish the exact CLI flags at time of writing. The flatten-and-upload method above is the reliably documented path — if X1 EcoChain publishes a Hardhat plugin or verification API key later, this guide should be updated to use it instead of flattening.

## Compiler settings reference

Both X1 Forge templates use:

| | |
|---|---|
| Solidity version | `0.8.24` |
| EVM target | `paris` (Hardhat default) |
| Optimizer | disabled by default (Hardhat default) |

Match these settings in the verifier form, or adjust `hardhat.config.js` and redeploy if you've customized them.
