const X1_TESTNET = {
  chainId: '0x2A1A', // 10778 in hex
  chainName: 'X1 EcoChain — Maculatus Testnet',
  nativeCurrency: { name: 'X1 Testnet Token', symbol: 'X1T', decimals: 18 },
  rpcUrls: ['https://maculatus-rpc.x1eco.com/'],
  blockExplorerUrls: ['https://maculatus-scan.x1eco.com/'],
};

// Minimal ABI for the Greeter sample contract.
const GREETER_ABI = [
  'function greet() view returns (string)',
  'function setGreeting(string) external',
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

document.getElementById('readBtn').addEventListener('click', async () => {
  try {
    const address = document.getElementById('contractAddress').value.trim();
    if (!address) throw new Error('Enter a deployed Greeter address first.');
    const provider = getProvider();
    const contract = new ethers.Contract(address, GREETER_ABI, provider);
    const greeting = await contract.greet();
    log(`greet() -> "${greeting}"`);
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

document.getElementById('writeBtn').addEventListener('click', async () => {
  try {
    const address = document.getElementById('contractAddress').value.trim();
    const newGreeting = document.getElementById('newGreeting').value.trim();
    if (!address) throw new Error('Enter a deployed Greeter address first.');
    if (!newGreeting) throw new Error('Enter a new greeting first.');
    const provider = getProvider();
    const signer = await provider.getSigner();
    const contract = new ethers.Contract(address, GREETER_ABI, signer);
    const tx = await contract.setGreeting(newGreeting);
    log(`Submitted tx: ${tx.hash}`);
    await tx.wait();
    log('Confirmed.');
  } catch (err) {
    log(`Error: ${err.message}`);
  }
});
