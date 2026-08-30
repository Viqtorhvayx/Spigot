// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Creator tipping for X1 EcoChain. Every tip splits automatically:
/// a fixed platform fee to the protocol treasury, the rest straight to the
/// creator — instantly, verifiably, on-chain.
contract Tipstream {
    struct Creator {
        string name;
        string bio;
        uint256 registeredAt;
        uint256 totalReceived; // net amount received, after fee
        uint256 tipCount;
    }

    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    address public immutable feeRecipient;

    mapping(address => Creator) public creators;
    address[] public creatorList;

    event CreatorRegistered(address indexed creator, string name, uint256 timestamp);
    event TipSent(address indexed from, address indexed to, uint256 payout, uint256 fee, string message);

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

        emit TipSent(msg.sender, creator, payout, fee, message);

        (bool sentCreator, ) = payable(creator).call{value: payout}("");
        require(sentCreator, "Payout to creator failed");
        (bool sentFee, ) = payable(feeRecipient).call{value: fee}("");
        require(sentFee, "Fee transfer failed");
    }

    function getCreators() external view returns (address[] memory) {
        return creatorList;
    }

    function creatorCount() external view returns (uint256) {
        return creatorList.length;
    }
}
