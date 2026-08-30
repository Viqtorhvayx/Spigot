// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Tipstream
/// @notice Creator tipping for X1 EcoChain. Every tip splits automatically:
/// a fixed platform fee to the protocol treasury, the rest credited to the
/// creator as a withdrawable balance — pulled, never pushed, so one broken
/// recipient can never block anyone else's tip.
contract Tipstream {
    struct Creator {
        string name;
        string bio;
        uint256 registeredAt;
        uint256 totalReceived; // lifetime net amount attributed to this creator
        uint256 tipCount;
    }

    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%
    uint256 public constant MAX_NAME_LENGTH = 64;
    uint256 public constant MAX_BIO_LENGTH = 280;
    uint256 public constant MAX_MESSAGE_LENGTH = 280;

    address public immutable feeRecipient;

    mapping(address => Creator) public creators;
    address[] public creatorList;
    mapping(address => uint256) public pendingWithdrawals;

    bool private locked;

    event CreatorRegistered(address indexed creator, string name, uint256 timestamp);
    event ProfileUpdated(address indexed creator, string name, uint256 timestamp);
    event TipSent(address indexed from, address indexed to, uint256 payout, uint256 fee, string message, uint256 timestamp);
    event Withdrawn(address indexed account, uint256 amount);

    error NameRequired();
    error NameTooLong();
    error BioTooLong();
    error MessageTooLong();
    error AlreadyRegistered();
    error NotRegistered();
    error CreatorNotRegistered();
    error TipMustBePositive();
    error NothingToWithdraw();
    error TransferFailed();
    error InvalidFeeRecipient();
    error ReentrancyBlocked();

    modifier nonReentrant() {
        if (locked) revert ReentrancyBlocked();
        locked = true;
        _;
        locked = false;
    }

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        feeRecipient = _feeRecipient;
    }

    /// @notice One-time page creation. Use `updateProfile` afterward to change it.
    function registerCreator(string calldata name, string calldata bio) external {
        _validateProfile(name, bio);
        if (creators[msg.sender].registeredAt != 0) revert AlreadyRegistered();

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

    /// @notice Update an existing page's name/bio. Stats and history are untouched.
    function updateProfile(string calldata name, string calldata bio) external {
        _validateProfile(name, bio);
        Creator storage c = creators[msg.sender];
        if (c.registeredAt == 0) revert NotRegistered();

        c.name = name;
        c.bio = bio;
        emit ProfileUpdated(msg.sender, name, block.timestamp);
    }

    /// @notice Send a tip. Splits msg.value between the creator and the
    /// platform fee recipient as pending withdrawals — call `withdraw()`
    /// to actually move the funds.
    function tip(address creator, string calldata message) external payable {
        if (msg.value == 0) revert TipMustBePositive();
        if (bytes(message).length > MAX_MESSAGE_LENGTH) revert MessageTooLong();
        if (creators[creator].registeredAt == 0) revert CreatorNotRegistered();

        uint256 fee = (msg.value * PLATFORM_FEE_BPS) / 10000;
        uint256 payout = msg.value - fee;

        Creator storage c = creators[creator];
        c.totalReceived += payout;
        c.tipCount += 1;

        pendingWithdrawals[creator] += payout;
        pendingWithdrawals[feeRecipient] += fee;

        emit TipSent(msg.sender, creator, payout, fee, message, block.timestamp);
    }

    /// @notice Pull your full pending balance. Works identically for
    /// creators and the platform fee recipient.
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();

        pendingWithdrawals[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    function getCreators() external view returns (address[] memory) {
        return creatorList;
    }

    function creatorCount() external view returns (uint256) {
        return creatorList.length;
    }

    function _validateProfile(string calldata name, string calldata bio) private pure {
        if (bytes(name).length == 0) revert NameRequired();
        if (bytes(name).length > MAX_NAME_LENGTH) revert NameTooLong();
        if (bytes(bio).length > MAX_BIO_LENGTH) revert BioTooLong();
    }
}
