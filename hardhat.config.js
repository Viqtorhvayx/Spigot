require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.24',
  networks: {
    x1Testnet: {
      // Maculatus Testnet — https://x1ecochain.gitbook.io/x1-ecochain-tech-whitepaper/development-environment/testnet
      url: 'https://maculatus-rpc.x1eco.com/',
      chainId: 10778,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
