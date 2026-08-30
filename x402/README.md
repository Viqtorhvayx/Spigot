# spigot-x402

HTTP 402 Payment Required middleware, backed by the [Spigot](../README.md)
contract on X1 EcoChain. This is what turns Spigot from "a settlement
contract" into something a real API can drop in front of itself: a
provider protects a route with one line, a caller (human or agent) gets a
`402` with machine-readable payment instructions, pays on-chain, and
retries with proof.

## How the loop works

```
GET /weather                          ──► 402 Payment Required
                                           { accepts: [{ contract, serviceId,
                                             maxAmountRequired, payVia, ... }] }

  caller calls payAndCall(serviceId) or callService(serviceId) on Spigot,
  gets a transaction hash back

GET /weather
X-PAYMENT: 0xabc123...                ──► verify the tx really is a
                                           CallSettled event for this
                                           service, not already redeemed
                                       ──► 200 OK { ...the actual response }
```

No off-chain facilitator, no separate verifier service — the proof
of payment *is* the on-chain `CallSettled` event Spigot already emits.
Verification is just: fetch the transaction receipt, decode the log,
check it matches this service, check it hasn't been redeemed before.

## Provider side

```js
const express = require('express');
const spigotPay = require('spigot-x402/spigotPay');

app.get(
  '/weather',
  spigotPay({ serviceId: 1, contractAddress: '0xf4b3...', rpcUrl: 'https://maculatus-rpc.x1eco.com/' }),
  (req, res) => {
    // req.spigot = { valid, receiptId, consumer, payout, fee, timestamp }
    res.json({ ...your actual response... });
  }
);
```

That's the whole integration. `spigotPay()` handles the 402 challenge,
verifies the `X-PAYMENT` header, and rejects replays.

## Consumer / agent side

```js
const { payAndCallX402 } = require('spigot-x402/client');

const res = await payAndCallX402('https://api.example.com/weather', {
  privateKey: process.env.CONSUMER_PRIVATE_KEY,
  rpcUrl: 'https://maculatus-rpc.x1eco.com/',
  mode: 'pay', // or 'credit' to draw from a prepaid depositCredit() balance
});
console.log(await res.json());
```

Makes the first request, sees the 402, pays on-chain, retries with proof
— all in one call. This is the shape any x402-aware HTTP client (or agent
framework) would wrap around outbound fetches automatically.

## Try it live

```bash
npm install
SPIGOT_SERVICE_ID=1 npm run server   # starts the demo API on :4021, protected by service #1 ("Demo Weather Feed")

# in another shell:
CONSUMER_PRIVATE_KEY=0x... PAY_MODE=pay npm run demo
```

This was run for real against the live Maculatus deployment while
building it: a request with no payment got a `402` with the real service
data (name, price, provider address) pulled live from the contract; the
demo client paid on-chain via `payAndCall`, retried, and got a real `200`
with `paidBy` matching the paying wallet and a real `receiptId`. Reusing
the same transaction hash a second time was correctly rejected with
`"this payment receipt has already been redeemed"`. The `credit` mode
(deposit once, draw down per call via `callService`) was verified the
same way.

## Limitations (said plainly)

- **`usedReceipts` is an in-memory `Set` by default** — fine for this
  demo and for a single-process deployment, but a multi-instance
  deployment needs a shared store (Redis, a DB table) keyed the same way
  (`contractAddress:receiptId`), passed in via the `usedReceipts` option.
- **No signature-based caller authentication.** Anyone who learns a valid
  `X-PAYMENT` transaction hash before the real payer redeems it could
  race to redeem it first — the check is "has this receipt been spent",
  not "did *you* spend it". For most pay-per-call APIs this is an
  acceptable tradeoff (the payment is still real and on-chain either
  way), but a provider serving caller-specific data would want to also
  check `req.spigot.consumer` against a signed request.
