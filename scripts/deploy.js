const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  // The deployer is the platform fee recipient for this deployment.
  // Swap in a dedicated treasury address for production.
  const feeRecipient = deployer.address;

  const Spigot = await hre.ethers.getContractFactory('Spigot');
  const spigot = await Spigot.deploy(feeRecipient);
  await spigot.waitForDeployment();

  const address = await spigot.getAddress();
  const deployTx = spigot.deploymentTransaction();
  const receipt = await deployTx.wait();

  console.log(`Spigot deployed to: ${address}`);
  console.log(`Deployment block: ${receipt.blockNumber}`);
  console.log(`Fee recipient: ${feeRecipient}`);
  console.log(`View it on the explorer: https://maculatus-scan.x1eco.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
