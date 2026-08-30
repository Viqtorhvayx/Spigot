const { ethers } = require('ethers');
const SPIGOT_ABI = require('./abi');

/// Verifies that a transaction hash is a real, successful, on-chain
/// CallSettled event for the given Spigot service — the on-chain proof
/// a client presents in the `X-PAYMENT` header after paying.
///
/// Framework-agnostic: no Express here, just ethers + a used-receipts
/// store, so it can be unit-tested and reused outside HTTP middleware.
async function verifySpigotPayment({ txHash, provider, contractAddress, serviceId, usedReceipts }) {
  if (!txHash || typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { valid: false, reason: 'X-PAYMENT header must be a transaction hash' };
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return { valid: false, reason: 'transaction not found (not yet mined, or wrong network)' };
  }
  if (receipt.status !== 1) {
    return { valid: false, reason: 'transaction reverted' };
  }
  if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
    return { valid: false, reason: 'transaction was not sent to the Spigot contract' };
  }

  const iface = new ethers.Interface(SPIGOT_ABI);
  let matched = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    let parsed;
    try {
      parsed = iface.parseLog(log);
    } catch {
      continue;
    }
    if (parsed?.name === 'CallSettled' && Number(parsed.args.serviceId) === Number(serviceId)) {
      matched = parsed.args;
      break;
    }
  }

  if (!matched) {
    return { valid: false, reason: `no CallSettled event for service #${serviceId} in that transaction` };
  }

  const receiptKey = `${contractAddress.toLowerCase()}:${matched.receiptId.toString()}`;
  if (usedReceipts.has(receiptKey)) {
    return { valid: false, reason: 'this payment receipt has already been redeemed' };
  }
  usedReceipts.add(receiptKey);

  return {
    valid: true,
    receiptId: matched.receiptId.toString(),
    consumer: matched.consumer,
    payout: matched.payout.toString(),
    fee: matched.fee.toString(),
    timestamp: Number(matched.timestamp),
  };
}

module.exports = { verifySpigotPayment };
