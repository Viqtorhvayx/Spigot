const hre = require('hardhat');

async function main() {
  const initialSupply = hre.ethers.parseEther('1000000'); // 1,000,000 X1S

  const X1Token = await hre.ethers.getContractFactory('X1Token');
  const token = await X1Token.deploy(initialSupply);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log(`X1Token deployed to: ${address}`);
  console.log(`View it on the explorer: https://maculatus-scan.x1eco.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
