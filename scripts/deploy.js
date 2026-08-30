const hre = require('hardhat');

async function main() {
  const Verinode = await hre.ethers.getContractFactory('Verinode');
  const pulse = await Verinode.deploy();
  await pulse.waitForDeployment();

  const address = await pulse.getAddress();
  console.log(`Verinode deployed to: ${address}`);
  console.log(`View it on the explorer: https://maculatus-scan.x1eco.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
