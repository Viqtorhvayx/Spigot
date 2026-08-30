const hre = require('hardhat');

async function main() {
  const initialSupply = hre.ethers.parseEther('100000'); // 100,000 X1F seed supply

  const X1FaucetToken = await hre.ethers.getContractFactory('X1FaucetToken');
  const token = await X1FaucetToken.deploy(initialSupply);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`X1FaucetToken deployed to: ${address}`);
  console.log(`View it on the explorer: https://maculatus-scan.x1eco.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
