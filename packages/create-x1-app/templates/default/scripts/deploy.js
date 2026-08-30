const hre = require('hardhat');

async function main() {
  const Greeter = await hre.ethers.getContractFactory('Greeter');
  const greeter = await Greeter.deploy('Hello, X1 EcoChain!');
  await greeter.waitForDeployment();

  const address = await greeter.getAddress();
  console.log(`Greeter deployed to: ${address}`);
  console.log(`View it on the explorer: https://maculatus-scan.x1eco.com/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
