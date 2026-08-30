// Demo API gated by Spigot: this is what a real provider's server looks
// like once spigotPay is dropped in front of a route. Run alongside
// example-client.js to see the full 402 -> pay on-chain -> 200 loop
// against the live Spigot contract on Maculatus.
const express = require('express');
const spigotPay = require('./spigotPay');

const CONTRACT_ADDRESS = process.env.SPIGOT_CONTRACT || '0xf4b3191C7a3315F0d2B375162E3025E78B25B595';
const RPC_URL = process.env.SPIGOT_RPC || 'https://maculatus-rpc.x1eco.com/';
const SERVICE_ID = Number(process.env.SPIGOT_SERVICE_ID ?? 1); // "Demo Weather Feed"
const PORT = process.env.PORT || 4021;

const app = express();

app.get(
  '/weather',
  spigotPay({ serviceId: SERVICE_ID, contractAddress: CONTRACT_ADDRESS, rpcUrl: RPC_URL }),
  (req, res) => {
    // req.spigot = { valid, receiptId, consumer, payout, fee, timestamp } — proof this request was paid for.
    res.json({
      condition: ['clear', 'cloudy', 'rain', 'windy'][Math.floor(Math.random() * 4)],
      tempC: Math.round((10 + Math.random() * 20) * 10) / 10,
      generatedAt: new Date().toISOString(),
      paidBy: req.spigot.consumer,
      receiptId: req.spigot.receiptId,
    });
  }
);

app.listen(PORT, () => {
  console.log(`Demo weather API listening on :${PORT}`);
  console.log(`Protected by Spigot service #${SERVICE_ID} on contract ${CONTRACT_ADDRESS}`);
  console.log(`Try: curl -i http://localhost:${PORT}/weather   (expect 402)`);
});
