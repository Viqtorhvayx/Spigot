const { expect } = require('chai');
const { ethers } = require('hardhat');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

describe('Tipstream', function () {
  async function deployFixture() {
    const [feeRecipient, creator, fan, otherFan] = await ethers.getSigners();
    const Tipstream = await ethers.getContractFactory('Tipstream');
    const tipstream = await Tipstream.deploy(feeRecipient.address);
    await tipstream.waitForDeployment();
    return { tipstream, feeRecipient, creator, fan, otherFan };
  }

  it('registers a creator and rejects a duplicate registration', async function () {
    const { tipstream, creator } = await deployFixture();

    await expect(tipstream.connect(creator).registerCreator('Ada', 'Building on X1'))
      .to.emit(tipstream, 'CreatorRegistered')
      .withArgs(creator.address, 'Ada', anyValue);

    const record = await tipstream.creators(creator.address);
    expect(record.name).to.equal('Ada');
    expect(await tipstream.creatorCount()).to.equal(1);

    await expect(
      tipstream.connect(creator).registerCreator('Ada', 'again')
    ).to.be.revertedWith('Already registered');
  });

  it('rejects a tip to an unregistered address', async function () {
    const { tipstream, fan, otherFan } = await deployFixture();
    await expect(
      tipstream.connect(fan).tip(otherFan.address, 'hi', { value: ethers.parseEther('1') })
    ).to.be.revertedWith('Creator not registered');
  });

  it('rejects a zero-value tip', async function () {
    const { tipstream, creator, fan } = await deployFixture();
    await tipstream.connect(creator).registerCreator('Ada', 'bio');
    await expect(
      tipstream.connect(fan).tip(creator.address, 'hi', { value: 0 })
    ).to.be.revertedWith('Tip must be > 0');
  });

  it('splits a tip between the creator and the platform fee recipient', async function () {
    const { tipstream, feeRecipient, creator, fan } = await deployFixture();
    await tipstream.connect(creator).registerCreator('Ada', 'bio');

    const tipAmount = ethers.parseEther('10');
    const expectedFee = (tipAmount * 250n) / 10000n; // 2.5%
    const expectedPayout = tipAmount - expectedFee;

    await expect(
      tipstream.connect(fan).tip(creator.address, 'gm!', { value: tipAmount })
    ).to.changeEtherBalances(
      [fan, creator, feeRecipient],
      [-tipAmount, expectedPayout, expectedFee]
    );

    const record = await tipstream.creators(creator.address);
    expect(record.totalReceived).to.equal(expectedPayout);
    expect(record.tipCount).to.equal(1);
  });

  it('accumulates stats across multiple tips from different fans', async function () {
    const { tipstream, creator, fan, otherFan } = await deployFixture();
    await tipstream.connect(creator).registerCreator('Ada', 'bio');

    await tipstream.connect(fan).tip(creator.address, 'first', { value: ethers.parseEther('1') });
    await tipstream.connect(otherFan).tip(creator.address, 'second', { value: ethers.parseEther('2') });

    const record = await tipstream.creators(creator.address);
    const expectedTotal = ethers.parseEther('3') - (ethers.parseEther('3') * 250n) / 10000n;
    expect(record.totalReceived).to.equal(expectedTotal);
    expect(record.tipCount).to.equal(2);
  });

  it('tracks multiple creators via getCreators', async function () {
    const { tipstream, creator, otherFan } = await deployFixture();
    await tipstream.connect(creator).registerCreator('Ada', 'bio');
    await tipstream.connect(otherFan).registerCreator('Bo', 'bio2');

    const list = await tipstream.getCreators();
    expect(list).to.deep.equal([creator.address, otherFan.address]);
    expect(await tipstream.creatorCount()).to.equal(2);
  });
});
