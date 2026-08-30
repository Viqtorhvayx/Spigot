const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Greeter', function () {
  it('returns the initial greeting and allows updates', async function () {
    const Greeter = await ethers.getContractFactory('Greeter');
    const greeter = await Greeter.deploy('Hello, X1 EcoChain!');
    await greeter.waitForDeployment();

    expect(await greeter.greet()).to.equal('Hello, X1 EcoChain!');

    await greeter.setGreeting('gm X1');
    expect(await greeter.greet()).to.equal('gm X1');
  });
});
