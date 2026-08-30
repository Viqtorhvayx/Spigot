const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('X1Token', function () {
  it('mints the initial supply to the deployer and supports transfers', async function () {
    const [deployer, recipient] = await ethers.getSigners();
    const initialSupply = ethers.parseEther('1000000');

    const X1Token = await ethers.getContractFactory('X1Token');
    const token = await X1Token.deploy(initialSupply);
    await token.waitForDeployment();

    expect(await token.name()).to.equal('X1 Sample Token');
    expect(await token.symbol()).to.equal('X1S');
    expect(await token.totalSupply()).to.equal(initialSupply);
    expect(await token.balanceOf(deployer.address)).to.equal(initialSupply);

    await token.transfer(recipient.address, ethers.parseEther('100'));
    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseEther('100'));
  });
});
