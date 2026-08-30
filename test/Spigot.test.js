const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { anyValue } = require('@nomicfoundation/hardhat-chai-matchers/withArgs');

describe('Spigot', function () {
  async function deployFixture() {
    const [feeRecipient, provider, consumer, otherConsumer] = await ethers.getSigners();
    const Spigot = await ethers.getContractFactory('Spigot');
    const spigot = await Spigot.deploy(feeRecipient.address);
    await spigot.waitForDeployment();
    return { spigot, feeRecipient, provider, consumer, otherConsumer };
  }

  async function registeredService(spigot, provider, overrides = {}) {
    const tx = await spigot
      .connect(provider)
      .registerService(
        overrides.name || 'Weather API',
        overrides.description || 'Real-time weather data',
        overrides.price || ethers.parseEther('0.01'),
        overrides.maxCallsPerDay ?? 0
      );
    await tx.wait();
    return 0; // first service registered in a fresh fixture is always id 0
  }

  describe('registerService / updateService', function () {
    it('registers a service and returns sequential ids', async function () {
      const { spigot, provider } = await deployFixture();

      await expect(
        spigot.connect(provider).registerService('Weather API', 'desc', ethers.parseEther('0.01'), 0)
      )
        .to.emit(spigot, 'ServiceRegistered')
        .withArgs(0, provider.address, 'Weather API', ethers.parseEther('0.01'));

      await spigot.connect(provider).registerService('Translate API', 'desc2', ethers.parseEther('0.02'), 0);
      expect(await spigot.totalServices()).to.equal(2);

      const s0 = await spigot.services(0);
      const s1 = await spigot.services(1);
      expect(s0.name).to.equal('Weather API');
      expect(s1.name).to.equal('Translate API');
    });

    it('rejects an empty name, an over-length name/description, or a zero price', async function () {
      const { spigot, provider } = await deployFixture();
      await expect(
        spigot.connect(provider).registerService('', 'desc', ethers.parseEther('0.01'), 0)
      ).to.be.revertedWithCustomError(spigot, 'NameRequired');

      await expect(
        spigot.connect(provider).registerService('x'.repeat(65), 'desc', ethers.parseEther('0.01'), 0)
      ).to.be.revertedWithCustomError(spigot, 'NameTooLong');

      await expect(
        spigot.connect(provider).registerService('ok', 'x'.repeat(281), ethers.parseEther('0.01'), 0)
      ).to.be.revertedWithCustomError(spigot, 'DescriptionTooLong');

      await expect(
        spigot.connect(provider).registerService('ok', 'desc', 0, 0)
      ).to.be.revertedWithCustomError(spigot, 'InvalidPrice');
    });

    it('lets only the provider update their service', async function () {
      const { spigot, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider);

      await expect(
        spigot.connect(consumer).updateService(id, 'New name', 'new desc', ethers.parseEther('0.02'), 0, true)
      ).to.be.revertedWithCustomError(spigot, 'NotServiceProvider');

      await expect(spigot.connect(provider).updateService(id, 'New name', 'new desc', ethers.parseEther('0.02'), 5, false))
        .to.emit(spigot, 'ServiceUpdated')
        .withArgs(id, 'New name', ethers.parseEther('0.02'), false);

      const s = await spigot.services(id);
      expect(s.name).to.equal('New name');
      expect(s.pricePerCall).to.equal(ethers.parseEther('0.02'));
      expect(s.maxCallsPerDay).to.equal(5);
      expect(s.active).to.equal(false);
    });

    it('rejects updating a nonexistent service', async function () {
      const { spigot, provider } = await deployFixture();
      await expect(
        spigot.connect(provider).updateService(99, 'x', 'y', ethers.parseEther('0.01'), 0, true)
      ).to.be.revertedWithCustomError(spigot, 'ServiceNotFound');
    });
  });

  describe('credit balance', function () {
    it('lets a consumer deposit and withdraw credit', async function () {
      const { spigot, consumer } = await deployFixture();

      await expect(spigot.connect(consumer).depositCredit({ value: ethers.parseEther('1') }))
        .to.emit(spigot, 'CreditDeposited')
        .withArgs(consumer.address, ethers.parseEther('1'));
      expect(await spigot.consumerBalance(consumer.address)).to.equal(ethers.parseEther('1'));

      await expect(
        spigot.connect(consumer).withdrawCredit(ethers.parseEther('0.4'))
      ).to.changeEtherBalance(consumer, ethers.parseEther('0.4'), { includeFee: false });
      expect(await spigot.consumerBalance(consumer.address)).to.equal(ethers.parseEther('0.6'));
    });

    it('rejects a zero deposit and withdrawing more than the balance', async function () {
      const { spigot, consumer } = await deployFixture();
      await expect(spigot.connect(consumer).depositCredit({ value: 0 })).to.be.revertedWithCustomError(
        spigot,
        'NothingToDeposit'
      );

      await expect(spigot.connect(consumer).withdrawCredit(1)).to.be.revertedWithCustomError(
        spigot,
        'InsufficientCredit'
      );
    });
  });

  describe('callService (prepaid balance)', function () {
    it('meters a call against prepaid credit and splits the fee correctly', async function () {
      const { spigot, feeRecipient, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('0.01') });
      await spigot.connect(consumer).depositCredit({ value: ethers.parseEther('1') });

      const fee = (ethers.parseEther('0.01') * 250n) / 10000n;
      const payout = ethers.parseEther('0.01') - fee;

      await expect(spigot.connect(consumer).callService(id))
        .to.emit(spigot, 'CallSettled')
        .withArgs(0, id, consumer.address, payout, fee, anyValue);

      expect(await spigot.consumerBalance(consumer.address)).to.equal(ethers.parseEther('0.99'));
      expect(await spigot.pendingWithdrawals(provider.address)).to.equal(payout);
      expect(await spigot.pendingWithdrawals(feeRecipient.address)).to.equal(fee);

      const s = await spigot.services(id);
      expect(s.totalCalls).to.equal(1);
      expect(s.totalRevenue).to.equal(payout);
    });

    it('rejects a call with insufficient credit', async function () {
      const { spigot, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('0.01') });
      await spigot.connect(consumer).depositCredit({ value: ethers.parseEther('0.005') });

      await expect(spigot.connect(consumer).callService(id)).to.be.revertedWithCustomError(
        spigot,
        'InsufficientCredit'
      );
    });

    it('rejects a call to a nonexistent or inactive service', async function () {
      const { spigot, provider, consumer } = await deployFixture();
      await spigot.connect(consumer).depositCredit({ value: ethers.parseEther('1') });

      await expect(spigot.connect(consumer).callService(99)).to.be.revertedWithCustomError(
        spigot,
        'ServiceNotFound'
      );

      const id = await registeredService(spigot, provider);
      await spigot.connect(provider).updateService(id, 'Weather API', 'desc', ethers.parseEther('0.01'), 0, false);
      await expect(spigot.connect(consumer).callService(id)).to.be.revertedWithCustomError(
        spigot,
        'ServiceInactive'
      );
    });
  });

  describe('payAndCall (direct payment)', function () {
    it('settles a call paid directly with msg.value', async function () {
      const { spigot, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('0.01') });

      const fee = (ethers.parseEther('0.01') * 250n) / 10000n;
      const payout = ethers.parseEther('0.01') - fee;

      await expect(
        spigot.connect(consumer).payAndCall(id, { value: ethers.parseEther('0.01') })
      ).to.changeEtherBalances([consumer, provider], [-ethers.parseEther('0.01'), 0]);

      expect(await spigot.pendingWithdrawals(provider.address)).to.equal(payout);
    });

    it('rejects an incorrect payment amount', async function () {
      const { spigot, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('0.01') });

      await expect(
        spigot.connect(consumer).payAndCall(id, { value: ethers.parseEther('0.005') })
      ).to.be.revertedWithCustomError(spigot, 'IncorrectPayment');
    });
  });

  describe('daily rate limiting', function () {
    it('enforces maxCallsPerDay and resets the next day', async function () {
      const { spigot, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('0.01'), maxCallsPerDay: 2 });
      await spigot.connect(consumer).depositCredit({ value: ethers.parseEther('1') });

      await spigot.connect(consumer).callService(id);
      await spigot.connect(consumer).callService(id);
      await expect(spigot.connect(consumer).callService(id)).to.be.revertedWithCustomError(
        spigot,
        'DailyLimitReached'
      );

      await time.increase(24 * 60 * 60 + 1);
      await expect(spigot.connect(consumer).callService(id)).to.not.be.reverted;
    });

    it('tracks limits independently per consumer', async function () {
      const { spigot, provider, consumer, otherConsumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('0.01'), maxCallsPerDay: 1 });
      await spigot.connect(consumer).depositCredit({ value: ethers.parseEther('1') });
      await spigot.connect(otherConsumer).depositCredit({ value: ethers.parseEther('1') });

      await spigot.connect(consumer).callService(id);
      await expect(spigot.connect(otherConsumer).callService(id)).to.not.be.reverted;
    });
  });

  describe('withdraw', function () {
    it('lets a provider withdraw earnings, and the fee recipient withdraw independently', async function () {
      const { spigot, feeRecipient, provider, consumer } = await deployFixture();
      const id = await registeredService(spigot, provider, { price: ethers.parseEther('1') });
      await spigot.connect(consumer).depositCredit({ value: ethers.parseEther('1') });
      await spigot.connect(consumer).callService(id);

      const fee = (ethers.parseEther('1') * 250n) / 10000n;
      const payout = ethers.parseEther('1') - fee;

      await expect(spigot.connect(provider).withdraw()).to.changeEtherBalance(provider, payout, { includeFee: false });
      await expect(spigot.connect(feeRecipient).withdraw()).to.changeEtherBalance(feeRecipient, fee, { includeFee: false });

      await expect(spigot.connect(provider).withdraw()).to.be.revertedWithCustomError(spigot, 'NothingToWithdraw');
    });
  });

  describe('displayNames', function () {
    it('lets any address set a display name', async function () {
      const { spigot, consumer } = await deployFixture();
      await expect(spigot.connect(consumer).setDisplayName('Agent-007'))
        .to.emit(spigot, 'DisplayNameSet')
        .withArgs(consumer.address, 'Agent-007');
      expect(await spigot.displayNames(consumer.address)).to.equal('Agent-007');
    });

    it('rejects a display name over the length limit', async function () {
      const { spigot, consumer } = await deployFixture();
      await expect(
        spigot.connect(consumer).setDisplayName('x'.repeat(65))
      ).to.be.revertedWithCustomError(spigot, 'NameTooLong');
    });
  });
});
