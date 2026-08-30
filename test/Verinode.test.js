const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('Verinode', function () {
  async function deployFixture() {
    const [operator, other] = await ethers.getSigners();
    const Verinode = await ethers.getContractFactory('Verinode');
    const pulse = await Verinode.deploy();
    await pulse.waitForDeployment();
    return { pulse, operator, other };
  }

  it('registers a node and rejects a duplicate registration', async function () {
    const { pulse, operator } = await deployFixture();

    await expect(pulse.connect(operator).registerNode('home-node-1'))
      .to.emit(pulse, 'NodeRegistered');

    const node = await pulse.nodes(operator.address);
    expect(node.label).to.equal('home-node-1');
    expect(await pulse.operatorCount()).to.equal(1);

    await expect(pulse.connect(operator).registerNode('home-node-1')).to.be.revertedWith('Already registered');
  });

  it('rejects a heartbeat from an unregistered address', async function () {
    const { pulse, other } = await deployFixture();
    await expect(pulse.connect(other).heartbeat()).to.be.revertedWith('Not registered');
  });

  it('accepts a heartbeat, enforces the minimum interval, and reports active status', async function () {
    const { pulse, operator } = await deployFixture();
    await pulse.connect(operator).registerNode('home-node-1');

    expect(await pulse.isActive(operator.address)).to.equal(false);

    await expect(pulse.connect(operator).heartbeat()).to.emit(pulse, 'HeartbeatSubmitted');
    expect(await pulse.isActive(operator.address)).to.equal(true);

    await expect(pulse.connect(operator).heartbeat()).to.be.revertedWith('Heartbeat too soon');

    await time.increase(30 * 60); // MIN_INTERVAL
    await pulse.connect(operator).heartbeat();

    const node = await pulse.nodes(operator.address);
    expect(node.heartbeatCount).to.equal(2);
  });

  it('reports a node inactive once the active window elapses', async function () {
    const { pulse, operator } = await deployFixture();
    await pulse.connect(operator).registerNode('home-node-1');
    await pulse.connect(operator).heartbeat();

    expect(await pulse.isActive(operator.address)).to.equal(true);

    await time.increase(2 * 60 * 60 + 1); // ACTIVE_WINDOW + 1s
    expect(await pulse.isActive(operator.address)).to.equal(false);
  });

  it('tracks multiple operators via getOperators', async function () {
    const { pulse, operator, other } = await deployFixture();
    await pulse.connect(operator).registerNode('home-node-1');
    await pulse.connect(other).registerNode('edge-node-2');

    const ops = await pulse.getOperators();
    expect(ops).to.deep.equal([operator.address, other.address]);
    expect(await pulse.operatorCount()).to.equal(2);
  });
});
