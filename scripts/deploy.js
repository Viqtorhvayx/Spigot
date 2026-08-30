const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  // The deployer is the platform fee recipient for this deployment.
  // Swap in a dedicated treasury address for production.
  const feeRecipient = deployer.address;

  const Tipstream = await hre.ethers.getContractFactory('Tipstream');
  const tipstream = await Tipstream.deploy(feeRecipient);
  await tipstream.waitForDeployment();

  const address = await tipstream.getAddress();
  console.log(`Tipstream deployed to: ${address}`);
  console.log(`Fee recipient: ${feeRecipient}`);
  console.log(`View it on the explorer: https://maculatus-scan.x1eco.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
