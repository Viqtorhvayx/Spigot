// Demo agent: calls the protected /weather endpoint with no payment,
// expects a 402, pays on-chain through Spigot, retries, and prints the
// paid response. Run example-server.js first.
const { payAndCallX402 } = require('./client');

const URL = process.env.DEMO_URL || 'http://localhost:4021/weather';
const RPC_URL = process.env.SPIGOT_RPC || 'https://maculatus-rpc.x1eco.com/';
const PRIVATE_KEY = process.env.CONSUMER_PRIVATE_KEY;
const MODE = process.env.PAY_MODE || 'pay'; // 'pay' or 'credit'

if (!PRIVATE_KEY) {
  console.error('Set CONSUMER_PRIVATE_KEY to a funded wallet before running this demo.');
  process.exit(1);
}

(async () => {
  console.log(`Requesting ${URL} with no payment...`);
  const first = await fetch(URL);
  console.log('First response status:', first.status);
  if (first.status === 402) {
    console.log('402 challenge:', JSON.stringify(await first.clone().json(), null, 2));
  }

  console.log(`\nPaying on-chain (mode=${MODE}) and retrying...`);
  const res = await payAndCallX402(URL, { privateKey: PRIVATE_KEY, rpcUrl: RPC_URL, mode: MODE });
  console.log('Final response status:', res.status);
  console.log('Body:', JSON.stringify(await res.json(), null, 2));
})();
