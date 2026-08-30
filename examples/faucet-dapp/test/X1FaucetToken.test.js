const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('X1FaucetToken', function () {
  it('mints an initial supply to the deployer', async function () {
    const [deployer] = await ethers.getSigners();
    const initialSupply = ethers.parseEther('100000');

    const Token = await ethers.getContractFactory('X1FaucetToken');
    const token = await Token.deploy(initialSupply);
    await token.waitForDeployment();

    expect(await token.balanceOf(deployer.address)).to.equal(initialSupply);
  });

  it('lets an address claim once per cooldown, and reverts before it elapses', async function () {
    const [, claimant] = await ethers.getSigners();
    const initialSupply = ethers.parseEther('100000');

    const Token = await ethers.getContractFactory('X1FaucetToken');
    const token = await Token.deploy(initialSupply);
    await token.waitForDeployment();

    await token.connect(claimant).claim();
    expect(await token.balanceOf(claimant.address)).to.equal(ethers.parseEther('50'));

    await expect(token.connect(claimant).claim()).to.be.revertedWith('Claim cooldown active');

    await time.increase(3600);
    await token.connect(claimant).claim();
    expect(await token.balanceOf(claimant.address)).to.equal(ethers.parseEther('100'));
  });

  it('reports time remaining until the next claim', async function () {
    const [, claimant] = await ethers.getSigners();
    const initialSupply = ethers.parseEther('100000');

    const Token = await ethers.getContractFactory('X1FaucetToken');
    const token = await Token.deploy(initialSupply);
    await token.waitForDeployment();

    expect(await token.timeUntilNextClaim(claimant.address)).to.equal(0);

    await token.connect(claimant).claim();
    const remaining = await token.timeUntilNextClaim(claimant.address);
    expect(remaining).to.be.greaterThan(0n);
    expect(remaining).to.be.lessThanOrEqual(3600n);
  });

  it('only lets the owner adjust claim amount and cooldown', async function () {
    const [owner, other] = await ethers.getSigners();
    const initialSupply = ethers.parseEther('100000');

    const Token = await ethers.getContractFactory('X1FaucetToken');
    const token = await Token.deploy(initialSupply);
    await token.waitForDeployment();

    await expect(token.connect(other).setClaimAmount(ethers.parseEther('100'))).to.be.reverted;

    await token.connect(owner).setClaimAmount(ethers.parseEther('100'));
    expect(await token.claimAmount()).to.equal(ethers.parseEther('100'));
  });
});
