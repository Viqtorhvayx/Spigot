const X1_TESTNET = {
  chainId: '0x2A1A', // 10778 in hex
  chainName: 'X1 EcoChain — Maculatus Testnet',
  nativeCurrency: { name: 'X1 Testnet Token', symbol: 'X1T', decimals: 18 },
  rpcUrls: ['https://maculatus-rpc.x1eco.com/'],
  blockExplorerUrls: ['https://maculatus-scan.x1eco.com/'],
};

// Minimal ABI for the X1Token sample ERC-20.
const TOKEN_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
];

const log = (msg) => {
  const el = document.getElementById('log');
  el.textContent += `${msg}\n`;
};

const getProvider = () => {
  if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
  return new ethers.BrowserProvider(window.ethereum);
};

document.getElementById('connectBtn').addEventListener('click', async () => {
  try {
    const provider = getProvider();
    const accounts = await provider.send('eth_requestAccounts', []);
    document.getElementById('account').textContent = accounts[0];
    log(`Connected: ${accounts[0]}`);
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('addNetworkBtn').addEventListener('click', async () => {
  try {
    if (!window.ethereum) throw new Error('No wallet found. Install MetaMask.');
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [X1_TESTNET],
    });
    log('X1 EcoChain testnet added to wallet.');
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('balanceBtn').addEventListener('click', async () => {
  try {
    const address = document.getElementById('contractAddress').value.trim();
    if (!address) throw new Error('Enter a deployed X1Token address first.');
    const provider = getProvider();
    const accounts = await provider.send('eth_requestAccounts', []);
    const contract = new ethers.Contract(address, TOKEN_ABI, provider);
    const [symbol, decimals, balance] = await Promise.all([
      contract.symbol(),
      contract.decimals(),
      contract.balanceOf(accounts[0]),
    ]);
    log(`Balance: ${ethers.formatUnits(balance, decimals)} ${symbol}`);
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('transferBtn').addEventListener('click', async () => {
  try {
    const address = document.getElementById('contractAddress').value.trim();
    const to = document.getElementById('transferTo').value.trim();
    const amount = document.getElementById('transferAmount').value.trim();
    if (!address) throw new Error('Enter a deployed X1Token address first.');
    if (!to) throw new Error('Enter a recipient address.');
    if (!amount) throw new Error('Enter an amount.');

    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(address, TOKEN_ABI, signer);
    const decimals = await contract.decimals();
    const tx = await contract.transfer(to, ethers.parseUnits(amount, decimals));
    log(`Submitted tx: ${tx.hash}`);
    await tx.wait();
    log('Confirmed.');
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});
