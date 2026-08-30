const { ethers } = require('ethers');
const SPIGOT_ABI = require('./abi');
const { verifySpigotPayment } = require('./verify');

/// Express middleware that turns any route into an x402-style paid
/// endpoint, settled through the Spigot contract on X1 EcoChain.
///
/// Usage:
///   const spigotPay = require('spigot-x402/spigotPay');
///   app.get('/weather', spigotPay({ serviceId: 0, contractAddress, rpcUrl }), handler);
///
/// Flow:
///   1. Request arrives with no `X-PAYMENT` header -> 402, with a JSON
///      body describing how to pay (price, contract, chain, service id).
///   2. Client pays on-chain (payAndCall or callService) and retries the
///      same request with `X-PAYMENT: <txHash>`.
///   3. Middleware verifies that tx really is a CallSettled event for
///      this service, hasn't been redeemed before, then calls next().
///
/// NOTE: `usedReceipts` defaults to an in-memory Set, which is fine for a
/// single-process demo but not for a multi-instance deployment — swap in
/// a shared store (Redis, a DB table) for that, keyed the same way.
function spigotPay({ serviceId, contractAddress, rpcUrl, usedReceipts, provider }) {
  if (serviceId === undefined) throw new Error('spigotPay: serviceId is required');
  if (!contractAddress) throw new Error('spigotPay: contractAddress is required');
  if (!rpcUrl && !provider) throw new Error('spigotPay: rpcUrl or provider is required');

  const rpc = provider || new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, SPIGOT_ABI, rpc);
  const seen = usedReceipts || new Set();

  return async function (req, res, next) {
    const txHash = req.header('X-PAYMENT');

    if (!txHash) {
      const challenge = await buildChallenge(contract, contractAddress, serviceId, rpc);
      return res.status(402).json(challenge);
    }

    let result;
    try {
      result = await verifySpigotPayment({ txHash, provider: rpc, contractAddress, serviceId, usedReceipts: seen });
    } catch (err) {
      return res.status(402).json({
        x402Version: 1,
        error: `could not verify payment: ${err.message}`,
      });
    }

    if (!result.valid) {
      const challenge = await buildChallenge(contract, contractAddress, serviceId, rpc);
      return res.status(402).json({ ...challenge, error: result.reason });
    }

    req.spigot = result;
    next();
  };
}

async function buildChallenge(contract, contractAddress, serviceId, provider) {
  const s = await contract.services(serviceId);
  const network = await provider.getNetwork();
  return {
    x402Version: 1,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'spigot-exact',
        network: `x1-eip155-${network.chainId}`,
        chainId: Number(network.chainId),
        contract: contractAddress,
        serviceId: Number(serviceId),
        serviceName: s.name,
        payTo: s.provider,
        maxAmountRequired: s.pricePerCall.toString(),
        maxAmountRequiredDisplay: `${ethers.formatEther(s.pricePerCall)} X1T`,
        payVia: [
          { method: 'payAndCall', args: [serviceId], value: s.pricePerCall.toString(), description: 'pay this exact amount directly with the call' },
          { method: 'callService', args: [serviceId], description: 'draw down from a prepaid depositCredit() balance' },
        ],
        proofHeader: 'X-PAYMENT',
        proofFormat: 'transaction hash of the payAndCall/callService transaction',
      },
    ],
  };
}

module.exports = spigotPay;
