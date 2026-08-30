const { ethers } = require('ethers');
const SPIGOT_ABI = require('./abi');

/// Client-side helper for calling a spigotPay-protected endpoint: makes
/// the initial request, and if it gets a 402, pays on-chain and retries
/// with the `X-PAYMENT` proof header. This is what an AI agent's HTTP
/// client would do automatically against any x402-style endpoint.
///
/// `mode`: 'pay' uses payAndCall (send exact value with the call, no
/// setup needed) or 'credit' uses callService (draws from a prepaid
/// depositCredit() balance — deposits enough to cover one call if the
/// balance is short).
async function payAndCallX402(url, { privateKey, rpcUrl, mode = 'pay', fetchOptions = {} } = {}) {
  const first = await fetch(url, fetchOptions);
  if (first.status !== 402) return first;

  const challenge = await first.json();
  const offer = challenge.accepts?.[0];
  if (!offer) throw new Error('402 response had no usable payment offer');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(offer.contract, SPIGOT_ABI, wallet);

  let tx;
  if (mode === 'credit') {
    const balance = await contract.consumerBalance(wallet.address);
    const price = BigInt(offer.maxAmountRequired);
    if (balance < price) {
      const top = await contract.depositCredit({ value: price - balance + price }); // pad one extra call's worth
      await top.wait();
    }
    tx = await contract.callService(offer.serviceId);
  } else {
    tx = await contract.payAndCall(offer.serviceId, { value: offer.maxAmountRequired });
  }
  const receipt = await tx.wait();

  return fetch(url, {
    ...fetchOptions,
    headers: { ...(fetchOptions.headers || {}), 'X-PAYMENT': receipt.hash },
  });
}

module.exports = { payAndCallX402 };
