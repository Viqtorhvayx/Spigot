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

  describe('registration', function () {
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
      ).to.be.revertedWithCustomError(tipstream, 'AlreadyRegistered');
    });

    it('rejects an empty name', async function () {
      const { tipstream, creator } = await deployFixture();
      await expect(
        tipstream.connect(creator).registerCreator('', 'bio')
      ).to.be.revertedWithCustomError(tipstream, 'NameRequired');
    });

    it('rejects a name or bio over the length limit', async function () {
      const { tipstream, creator, otherFan } = await deployFixture();
      const longName = 'x'.repeat(65); // MAX_NAME_LENGTH is 64
      const longBio = 'x'.repeat(281); // MAX_BIO_LENGTH is 280

      await expect(
        tipstream.connect(creator).registerCreator(longName, 'bio')
      ).to.be.revertedWithCustomError(tipstream, 'NameTooLong');

      await expect(
        tipstream.connect(otherFan).registerCreator('Ada', longBio)
      ).to.be.revertedWithCustomError(tipstream, 'BioTooLong');
    });
  });

  describe('updateProfile', function () {
    it('lets a registered creator update their name and bio', async function () {
      const { tipstream, creator } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'old bio');

      await expect(tipstream.connect(creator).updateProfile('Ada B.', 'new bio'))
        .to.emit(tipstream, 'ProfileUpdated')
        .withArgs(creator.address, 'Ada B.', anyValue);

      const record = await tipstream.creators(creator.address);
      expect(record.name).to.equal('Ada B.');
      expect(record.bio).to.equal('new bio');
    });

    it('rejects updating a profile that was never registered', async function () {
      const { tipstream, creator } = await deployFixture();
      await expect(
        tipstream.connect(creator).updateProfile('Ada', 'bio')
      ).to.be.revertedWithCustomError(tipstream, 'NotRegistered');
    });

    it('does not reset stats or history when updating a profile', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      await tipstream.connect(fan).tip(creator.address, 'gm', { value: ethers.parseEther('1') });

      await tipstream.connect(creator).updateProfile('Ada B.', 'new bio');

      const record = await tipstream.creators(creator.address);
      expect(record.tipCount).to.equal(1);
      expect(record.totalReceived).to.be.greaterThan(0);
    });
  });

  describe('tipping', function () {
    it('rejects a tip to an unregistered address', async function () {
      const { tipstream, fan, otherFan } = await deployFixture();
      await expect(
        tipstream.connect(fan).tip(otherFan.address, 'hi', { value: ethers.parseEther('1') })
      ).to.be.revertedWithCustomError(tipstream, 'CreatorNotRegistered');
    });

    it('rejects a zero-value tip', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      await expect(
        tipstream.connect(fan).tip(creator.address, 'hi', { value: 0 })
      ).to.be.revertedWithCustomError(tipstream, 'TipMustBePositive');
    });

    it('rejects a message over the length limit', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      const longMessage = 'x'.repeat(281); // MAX_MESSAGE_LENGTH is 280
      await expect(
        tipstream.connect(fan).tip(creator.address, longMessage, { value: ethers.parseEther('1') })
      ).to.be.revertedWithCustomError(tipstream, 'MessageTooLong');
    });

    it('splits a tip into pending withdrawals for the creator and fee recipient', async function () {
      const { tipstream, feeRecipient, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      const tipAmount = ethers.parseEther('10');
      const expectedFee = (tipAmount * 250n) / 10000n; // 2.5%
      const expectedPayout = tipAmount - expectedFee;

      // Tipping moves no funds directly — it only credits pending withdrawals.
      await expect(
        tipstream.connect(fan).tip(creator.address, 'gm!', { value: tipAmount })
      ).to.changeEtherBalances([fan, creator, feeRecipient], [-tipAmount, 0, 0]);

      expect(await tipstream.pendingWithdrawals(creator.address)).to.equal(expectedPayout);
      expect(await tipstream.pendingWithdrawals(feeRecipient.address)).to.equal(expectedFee);

      const record = await tipstream.creators(creator.address);
      expect(record.totalReceived).to.equal(expectedPayout);
      expect(record.tipCount).to.equal(1);
    });

    it('accumulates stats and pending balance across multiple tips from different fans', async function () {
      const { tipstream, creator, fan, otherFan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      await tipstream.connect(fan).tip(creator.address, 'first', { value: ethers.parseEther('1') });
      await tipstream.connect(otherFan).tip(creator.address, 'second', { value: ethers.parseEther('2') });

      const expectedTotal = ethers.parseEther('3') - (ethers.parseEther('3') * 250n) / 10000n;
      const record = await tipstream.creators(creator.address);
      expect(record.totalReceived).to.equal(expectedTotal);
      expect(record.tipCount).to.equal(2);
      expect(await tipstream.pendingWithdrawals(creator.address)).to.equal(expectedTotal);
    });
  });

  describe('withdraw', function () {
    it('lets a creator withdraw their pending balance, and zeroes it after', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      const tipAmount = ethers.parseEther('10');
      const expectedPayout = tipAmount - (tipAmount * 250n) / 10000n;
      await tipstream.connect(fan).tip(creator.address, 'gm!', { value: tipAmount });

      await expect(tipstream.connect(creator).withdraw())
        .to.changeEtherBalance(creator, expectedPayout, { includeFee: false });

      expect(await tipstream.pendingWithdrawals(creator.address)).to.equal(0);
      await expect(
        tipstream.connect(creator).withdraw()
      ).to.be.revertedWithCustomError(tipstream, 'NothingToWithdraw');
    });

    it('lets the fee recipient withdraw independently of any creator', async function () {
      const { tipstream, feeRecipient, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      const tipAmount = ethers.parseEther('10');
      const expectedFee = (tipAmount * 250n) / 10000n;
      await tipstream.connect(fan).tip(creator.address, 'gm!', { value: tipAmount });

      await expect(tipstream.connect(feeRecipient).withdraw())
        .to.changeEtherBalance(feeRecipient, expectedFee, { includeFee: false });
    });
  });

  it('tracks multiple creators via getCreators', async function () {
    const { tipstream, creator, otherFan } = await deployFixture();
    await tipstream.connect(creator).registerCreator('Ada', 'bio');
    await tipstream.connect(otherFan).registerCreator('Bo', 'bio2');

    const list = await tipstream.getCreators();
    expect(list).to.deep.equal([creator.address, otherFan.address]);
    expect(await tipstream.creatorCount()).to.equal(2);
  });

  describe('displayNames', function () {
    it('lets any address, not just creators, set a display name', async function () {
      const { tipstream, fan } = await deployFixture();
      await expect(tipstream.connect(fan).setDisplayName('Fan Fave'))
        .to.emit(tipstream, 'DisplayNameSet')
        .withArgs(fan.address, 'Fan Fave');
      expect(await tipstream.displayNames(fan.address)).to.equal('Fan Fave');
    });

    it('rejects a display name over the length limit', async function () {
      const { tipstream, fan } = await deployFixture();
      await expect(
        tipstream.connect(fan).setDisplayName('x'.repeat(65))
      ).to.be.revertedWithCustomError(tipstream, 'NameTooLong');
    });
  });

  describe('following', function () {
    it('lets a fan follow and unfollow a creator, updating followerCount', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      await expect(tipstream.connect(fan).follow(creator.address))
        .to.emit(tipstream, 'Followed')
        .withArgs(fan.address, creator.address);
      expect(await tipstream.isFollowing(fan.address, creator.address)).to.equal(true);
      expect((await tipstream.creators(creator.address)).followerCount).to.equal(1);

      await expect(tipstream.connect(fan).unfollow(creator.address))
        .to.emit(tipstream, 'Unfollowed')
        .withArgs(fan.address, creator.address);
      expect(await tipstream.isFollowing(fan.address, creator.address)).to.equal(false);
      expect((await tipstream.creators(creator.address)).followerCount).to.equal(0);
    });

    it('rejects following an unregistered address, yourself, or twice', async function () {
      const { tipstream, creator, fan, otherFan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      await expect(
        tipstream.connect(fan).follow(otherFan.address)
      ).to.be.revertedWithCustomError(tipstream, 'CreatorNotRegistered');

      await expect(
        tipstream.connect(creator).follow(creator.address)
      ).to.be.revertedWithCustomError(tipstream, 'CannotFollowSelf');

      await tipstream.connect(fan).follow(creator.address);
      await expect(
        tipstream.connect(fan).follow(creator.address)
      ).to.be.revertedWithCustomError(tipstream, 'AlreadyFollowing');
    });

    it('rejects unfollowing when not currently following', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      await expect(
        tipstream.connect(fan).unfollow(creator.address)
      ).to.be.revertedWithCustomError(tipstream, 'NotFollowing');
    });
  });

  describe('goals', function () {
    it('lets a registered creator set and clear a funding goal', async function () {
      const { tipstream, creator } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      const target = ethers.parseEther('100');
      await expect(tipstream.connect(creator).setGoal(target, 'New microphone'))
        .to.emit(tipstream, 'GoalSet')
        .withArgs(creator.address, target, 'New microphone');

      let record = await tipstream.creators(creator.address);
      expect(record.goalTarget).to.equal(target);
      expect(record.goalDescription).to.equal('New microphone');

      await tipstream.connect(creator).setGoal(0, '');
      record = await tipstream.creators(creator.address);
      expect(record.goalTarget).to.equal(0);
    });

    it('rejects setting a goal for an unregistered address', async function () {
      const { tipstream, fan } = await deployFixture();
      await expect(
        tipstream.connect(fan).setGoal(ethers.parseEther('10'), 'goal')
      ).to.be.revertedWithCustomError(tipstream, 'NotRegistered');
    });

    it('rejects a goal description over the length limit', async function () {
      const { tipstream, creator } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      await expect(
        tipstream.connect(creator).setGoal(1, 'x'.repeat(141))
      ).to.be.revertedWithCustomError(tipstream, 'GoalDescriptionTooLong');
    });
  });

  describe('tip replies', function () {
    it('lets the receiving creator reply to a specific tip, identified by its id', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');

      const tx = await tipstream.connect(fan).tip(creator.address, 'gm!', { value: ethers.parseEther('1') });
      const receipt = await tx.wait();
      const tipEvent = receipt.logs
        .map((log) => { try { return tipstream.interface.parseLog(log); } catch { return null; } })
        .find((e) => e && e.name === 'TipSent');
      const tipId = tipEvent.args.tipId;

      expect(await tipstream.tipRecipient(tipId)).to.equal(creator.address);

      await expect(tipstream.connect(creator).replyToTip(tipId, 'thank you!'))
        .to.emit(tipstream, 'TipReplied')
        .withArgs(tipId, creator.address, 'thank you!', anyValue);

      expect(await tipstream.tipReplies(tipId)).to.equal('thank you!');
    });

    it('rejects a reply from anyone other than the tip\'s recipient', async function () {
      const { tipstream, creator, fan, otherFan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      await tipstream.connect(fan).tip(creator.address, 'gm!', { value: ethers.parseEther('1') });

      await expect(
        tipstream.connect(otherFan).replyToTip(0, 'not yours to reply to')
      ).to.be.revertedWithCustomError(tipstream, 'NotTipRecipient');
    });

    it('rejects a reply over the length limit', async function () {
      const { tipstream, creator, fan } = await deployFixture();
      await tipstream.connect(creator).registerCreator('Ada', 'bio');
      await tipstream.connect(fan).tip(creator.address, 'gm!', { value: ethers.parseEther('1') });

      await expect(
        tipstream.connect(creator).replyToTip(0, 'x'.repeat(281))
      ).to.be.revertedWithCustomError(tipstream, 'ReplyTooLong');
    });
  });
});
