// The Verinode agent — the actual piece a node operator runs (e.g. via cron
// or as a long-lived process) to submit periodic on-chain liveness heartbeats.
// This is a plain Node script, independent of Hardhat, so it can run on the
// same machine as the node itself.
'use strict';

require('dotenv').config();
const { ethers } = require('ethers');

const RPC_URL = 'https://maculatus-rpc.x1eco.com/';
const CHAIN_ID = 10778;
const MIN_INTERVAL_MS = 30 * 60 * 1000; // matches Verinode.MIN_INTERVAL

const ABI = [
  'function registerNode(string label) external',
  'function heartbeat() external',
  'function nodes(address) view returns (string label, uint256 registeredAt, uint256 lastHeartbeat, uint256 heartbeatCount)',
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

async function ensureRegistered(contract, label) {
  const node = await contract.nodes(await contract.runner.getAddress());
  if (node.registeredAt !== 0n) {
    console.log(`Already registered as "${node.label}" since block timestamp ${node.registeredAt}.`);
    return;
  }
  console.log(`Registering node as "${label}"...`);
  const tx = await contract.registerNode(label);
  await tx.wait();
  console.log(`Registered. tx: ${tx.hash}`);
}

async function sendHeartbeat(contract) {
  try {
    const tx = await contract.heartbeat();
    console.log(`[${new Date().toISOString()}] heartbeat submitted: ${tx.hash}`);
    await tx.wait();
    console.log(`[${new Date().toISOString()}] heartbeat confirmed`);
  } catch (err) {
    // "Heartbeat too soon" is expected if the agent starts before the
    // previous interval has elapsed (e.g. a restart) — not a failure.
    console.log(`[${new Date().toISOString()}] heartbeat skipped: ${err.reason || err.shortMessage || err.message}`);
  }
}

async function main() {
  const privateKey = requireEnv('PRIVATE_KEY');
  const contractAddress = requireEnv('CONTRACT_ADDRESS');
  const label = process.env.NODE_LABEL || 'x1-node';

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(contractAddress, ABI, wallet);

  console.log(`Verinode agent starting for ${wallet.address} against ${contractAddress}`);
  await ensureRegistered(contract, label);
  await sendHeartbeat(contract);

  setInterval(() => sendHeartbeat(contract), MIN_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
