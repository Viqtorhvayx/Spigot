// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Creator tipping for X1 EcoChain. Every tip splits automatically:
/// a fixed platform fee to the protocol treasury, the rest to the creator.
/// Funds accumulate as a withdrawable balance rather than being pushed
/// immediately, so one recipient's misbehaving `receive()` can never block
/// anyone else's tip.
contract Tipstream {
    struct Creator {
        string name;
        string bio;
        uint256 registeredAt;
        uint256 totalReceived; // lifetime net amount attributed to this creator
        uint256 tipCount;
    }

    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    address public immutable feeRecipient;

    mapping(address => Creator) public creators;
    address[] public creatorList;
    mapping(address => uint256) public pendingWithdrawals;

    event CreatorRegistered(address indexed creator, string name, uint256 timestamp);
    event TipSent(address indexed from, address indexed to, uint256 payout, uint256 fee, string message, uint256 timestamp);
    event Withdrawn(address indexed account, uint256 amount);

    constructor(address _feeRecipient) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    function registerCreator(string calldata name, string calldata bio) external {
        require(bytes(name).length > 0, "Name required");
        require(bytes(creators[msg.sender].name).length == 0, "Already registered");

        creators[msg.sender] = Creator({
            name: name,
            bio: bio,
            registeredAt: block.timestamp,
            totalReceived: 0,
            tipCount: 0
        });
        creatorList.push(msg.sender);
        emit CreatorRegistered(msg.sender, name, block.timestamp);
    }

    function tip(address creator, string calldata message) external payable {
        require(msg.value > 0, "Tip must be > 0");
        require(bytes(creators[creator].name).length > 0, "Creator not registered");

        uint256 fee = (msg.value * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = msg.value - fee;

        Creator storage c = creators[creator];
        c.totalReceived += payout;
        c.tipCount += 1;

        pendingWithdrawals[creator] += payout;
        pendingWithdrawals[feeRecipient] += fee;

        emit TipSent(msg.sender, creator, payout, fee, message, block.timestamp);
    }

    function withdraw() external {
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Withdraw failed");
    }

    function getCreators() external view returns (address[] memory) {
        return creatorList;
    }

    function creatorCount() external view returns (uint256) {
        return creatorList.length;
    }
}
